"""Train the CPU NNUE from the arrays produced by preprocess_dataset.py."""

import argparse
import math
from pathlib import Path
from tempfile import TemporaryDirectory
from time import monotonic

import numpy as np
import torch
from torch.nn import functional as F

from neurachess.neural.nnue import (
    ARCHITECTURE,
    BLACK_INDEX,
    FEATURES,
    MATERIAL,
    PADDING,
    KingBucketNNUE,
    king_bucket,
)


def encode_rows(rows):
    """Convert the existing rank-8-first planes to sparse, mover-first inputs."""
    pieces = rows[:, :768].reshape(-1, 12, 64)
    material = pieces.sum(axis=2) @ MATERIAL
    white_turn = rows[:, 768].astype(bool)
    material = np.where(white_turn, material, -material).astype(np.float32)
    # The old encoding stores the White king on a rank-mirrored square. Black's
    # square is already rank-mirrored for its own perspective.
    king_squares = np.stack((pieces[:, 5].argmax(1) ^ 56, pieces[:, 11].argmax(1)))
    bucket = king_bucket(king_squares)
    row, index = np.nonzero(np.concatenate((rows[:, :768], rows[:, 769:]), axis=1))
    index = np.where(index < 768, index ^ 56, index)
    counts = np.bincount(row, minlength=len(rows))
    slots = np.arange(len(row)) - np.repeat(counts.cumsum() - counts, counts)
    indices = np.full((len(rows), 2, 36), PADDING, dtype=np.int16)
    white_slot = (~white_turn[row]).astype(np.intp)
    indices[row, white_slot, slots] = FEATURES * bucket[0, row] + index
    indices[row, 1 - white_slot, slots] = FEATURES * bucket[1, row] + BLACK_INDEX[index]
    return indices, material


def load_data(directory):
    rows = np.load(directory / "X.npy", mmap_mode="r")
    labels = np.load(directory / "y.npy", mmap_mode="r")
    if rows.shape != (len(labels), 773) or labels.shape != (len(rows), 1):
        raise ValueError("Expected matching X.npy and y.npy from preprocess_dataset.py")
    indices = np.empty((len(rows), 2, 36), dtype=np.int16)
    material = np.empty(len(rows), dtype=np.float32)
    for start in range(0, len(rows), 8192):
        batch = slice(start, start + 8192)
        indices[batch], material[batch] = encode_rows(rows[batch])
    targets = np.where(rows[:, 768], labels[:, 0], -labels[:, 0])
    return tuple(torch.from_numpy(x) for x in (indices, material, targets))


def objective(pred, target):
    # Expected score emphasizes small swings in competitive positions. A small
    # regression term preserves useful distinctions in clearly winning endgames.
    error = (pred / 3).sigmoid() - (target / 3).sigmoid()
    return error.square().mean() + 0.002 * F.smooth_l1_loss(pred, target)


@torch.inference_mode()
def measure(model, data, ids, batch_size):
    errors, losses = [], []
    for batch in ids.split(batch_size):
        x, material, y = (a[batch] for a in data)
        pred = model(x.int(), material)
        errors.append((pred - y).abs())
        losses.append(objective(pred, y).item() * len(batch))
    errors = torch.cat(errors) * 100
    equal = data[2][ids].abs() <= 1.5
    return {
        "loss": sum(losses) / len(ids),
        "mae_cp": errors.mean().item(),
        "close_mae_cp": errors[equal].mean().item(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("data/encoded"))
    parser.add_argument("--output", type=Path, default=Path("checkpoints/nnue_v001.pt"))
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=1024)
    parser.add_argument("--threads", type=int, default=3)
    args = parser.parse_args()
    if min(args.epochs, args.batch_size, args.threads) < 1:
        parser.error("epochs, batch size and threads must be positive")
    if args.output.exists():
        parser.error("choose a new output path to preserve the existing checkpoint")
    torch.manual_seed(42)
    torch.set_num_threads(args.threads)
    data = load_data(args.data)
    # Match the MLP notebook's seeded 80/10/10 split for a fair comparison.
    subsets = torch.utils.data.random_split(
        range(len(data[0])),
        [0.8, 0.1, 0.1],
        generator=torch.Generator().manual_seed(42),
    )
    train, val, test = [torch.tensor(s.indices) for s in subsets]
    model = KingBucketNNUE()
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.002, weight_decay=0.001)
    best = math.inf
    args.output.parent.mkdir(parents=True, exist_ok=True)
    for epoch in range(1, args.epochs + 1):
        start = monotonic()
        model.train()
        fraction = (epoch - 1) / max(1, args.epochs - 1)
        optimizer.param_groups[0]["lr"] = (
            0.0003 + 0.0017 * (1 + math.cos(math.pi * fraction)) / 2
        )
        for batch in train[torch.randperm(len(train))].split(args.batch_size):
            x, material, y = (a[batch] for a in data)
            optimizer.zero_grad(set_to_none=True)
            loss = objective(model(x.int(), material), y)
            loss.backward()
            optimizer.step()
        model.eval()
        metrics = measure(model, data, val, args.batch_size)
        print(
            f"Epoch {epoch}/{args.epochs} ({monotonic() - start:.1f}s) validation {metrics}",
            flush=True,
        )
        if metrics["loss"] < best:
            checkpoint = {
                "architecture": ARCHITECTURE,
                "model_state_dict": model.state_dict(),
                "epoch": epoch,
                "val_mae_cp": metrics["mae_cp"],
                "val_loss": metrics["loss"],
                "train_rows": len(train),
                "val_rows": len(val),
                "split_seed": 42,
            }
            with TemporaryDirectory(dir=args.output.parent) as staging:
                temp = Path(staging) / "weights.pt"
                torch.save(checkpoint, temp)
                if best == math.inf:
                    # Claim the output only after a complete save. A concurrent
                    # run targeting the same filename cannot overwrite this one.
                    args.output.hardlink_to(temp)
                else:
                    temp.replace(args.output)
            best = metrics["loss"]
    model.load_state_dict(
        torch.load(args.output, weights_only=True)["model_state_dict"]
    )
    print(
        f"Best checkpoint test ({len(test)} positions): {measure(model, data, test, args.batch_size)}",
        flush=True,
    )


if __name__ == "__main__":
    main()
