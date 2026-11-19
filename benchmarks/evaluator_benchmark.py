"""Compare the existing evaluators on held-out validation positions.

Both evaluators receive the same nonterminal boards. The terminal filter uses
the neural evaluator's draw-claim policy and the history available in each FEN.
Stockfish targets are the White-relative, clipped `cp` values used for training.
Speed includes all work inside each evaluator's public call, including neural
board encoding and its terminal check.
"""

import argparse
import hashlib
import json
import math
import platform
import random
import statistics
import time
from pathlib import Path

import chess
import numpy as np
import pyarrow.parquet as pq
import torch
from torch.utils.data import random_split

from neurachess.evaluation import evaluate_material
from neurachess.neural.dataset import ChessDataset
from neurachess.neural.encoding import encode_board
from neurachess.neural.evaluator import NeuralEvaluator

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "data/chess_positions.parquet"
ENCODED = ROOT / "data/encoded"
RESULTS = ROOT / "benchmarks/results"
SPLIT_SEED = 42
SPLIT_FRACTIONS = [0.8, 0.1, 0.1]
WARMUP_POSITIONS = 100
# Same boundaries as scripts/build_dataset.py:eval_bucket.
BUCKETS = (
    ("Strong Black", "cp < -500"),
    ("Moderate Black", "-500 <= cp < -150"),
    ("Equal", "-150 <= cp <= 150"),
    ("Moderate White", "150 < cp <= 500"),
    ("Strong White", "500 < cp"),
)


def validation_indices(row_count):
    _, validation, _ = random_split(
        range(row_count),
        SPLIT_FRACTIONS,
        generator=torch.Generator().manual_seed(SPLIT_SEED),
    )
    return validation.indices


def select_positions(fens, labels, indices, samples, seed, encoded=None):
    if samples > len(indices):
        raise ValueError(
            f"Requested {samples:,} samples from {len(indices):,} validation rows."
        )

    positions = []
    skipped = 0
    for index in random.Random(seed).sample(indices, k=len(indices)):
        board = chess.Board(fens[index].as_py())
        if board.is_game_over(claim_draw=True):
            skipped += 1
            continue
        if encoded is not None and not np.array_equal(
            encode_board(board).numpy(), encoded.fen_encoded[index]
        ):
            raise ValueError(
                f"Encoded training features differ from parquet FEN at row {index}."
            )
        positions.append((board, float(labels[index])))
        if len(positions) == samples:
            return positions, skipped

    raise ValueError(f"Found only {len(positions):,} nonterminal validation rows.")


def load_positions(samples, seed):
    table = pq.read_table(DATASET, columns=["fen", "cp"], use_threads=False)
    encoded = ChessDataset(ENCODED)
    if len(encoded) != len(table) or encoded.cp_pawn_units.shape != (len(table), 1):
        raise ValueError(
            "Parquet rows and encoded training arrays have different lengths."
        )

    indices = validation_indices(len(encoded))
    labels = table["cp"].to_numpy()
    expected_pawns = (labels[indices] / 100.0).astype(np.float32)
    if not np.array_equal(encoded.cp_pawn_units[indices, 0], expected_pawns):
        raise ValueError("Validation labels differ from the encoded training targets.")

    positions, skipped = select_positions(
        table["fen"], labels, indices, samples, seed, encoded=encoded
    )
    return positions, {
        "path": str(DATASET.relative_to(ROOT)),
        "sha256": file_sha256(DATASET),
        "rows": len(table),
        "split": "validation",
        "split_seed": SPLIT_SEED,
        "split_fractions": SPLIT_FRACTIONS,
        "validation_rows": len(indices),
        "target": "White-relative Stockfish cp column, as stored",
        "terminal_policy": "Skip boards where is_game_over(claim_draw=True) from FEN",
        "terminal_positions_skipped": skipped,
    }


def load_neural(checkpoint_path):
    evaluator = NeuralEvaluator(checkpoint_path, require_architecture=True)
    if evaluator.model.training:
        raise ValueError("Neural evaluator must be in evaluation mode.")

    return evaluator, {
        "path": str(checkpoint_path),
        "sha256": file_sha256(checkpoint_path),
        "architecture_source": evaluator.architecture_source,
        "configuration": evaluator.checkpoint_configuration,
    }


def file_sha256(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def bucket_ids(scores):
    return np.select(
        [scores < -500, scores < -150, scores <= 150, scores <= 500],
        [0, 1, 2, 3],
        default=4,
    )


def accuracy_metrics(errors):
    return {
        "mae_cp": float(np.mean(np.abs(errors))),
        "rmse_cp": math.sqrt(np.mean(np.square(errors))),
        "bias_cp": float(np.mean(errors)),
    }


def benchmark_accuracy(positions, evaluators):
    labels = np.array([label for _, label in positions], dtype=np.float64)
    predictions = {
        name: np.array([evaluate(board) for board, _ in positions], dtype=np.float64)
        for name, evaluate in evaluators.items()
    }
    if not all(np.isfinite(scores).all() for scores in predictions.values()):
        raise ValueError("An evaluator returned a non-finite score.")
    errors = {name: scores - labels for name, scores in predictions.items()}
    neural_better = np.abs(errors["neural"]) < np.abs(errors["material"])
    label_buckets = bucket_ids(labels)
    predicted_buckets = {
        name: bucket_ids(scores) for name, scores in predictions.items()
    }

    buckets = []
    for bucket_id, (name, interval) in enumerate(BUCKETS):
        mask = label_buckets == bucket_id
        buckets.append(
            {
                "name": name,
                "interval_cp": interval,
                "positions": int(mask.sum()),
                "evaluators": {
                    evaluator: {
                        **accuracy_metrics(error[mask]),
                        "bucket_accuracy_pct": float(
                            100
                            * np.mean(predicted_buckets[evaluator][mask] == bucket_id)
                        ),
                    }
                    for evaluator, error in errors.items()
                }
                if mask.any()
                else {},
            }
        )
    return {
        "evaluators": {name: accuracy_metrics(error) for name, error in errors.items()},
        "neural_better_pct": float(100 * np.mean(neural_better)),
        "buckets": buckets,
    }


def benchmark_speed(boards, evaluators, repeats):
    warmup = boards[:WARMUP_POSITIONS]
    for evaluate in evaluators.values():
        for board in warmup:
            evaluate(board)

    timings = {name: [] for name in evaluators}
    order = list(evaluators)
    for _ in range(repeats):
        for name in order:
            evaluate = evaluators[name]
            start = time.perf_counter()
            for board in boards:
                evaluate(board)
            timings[name].append(time.perf_counter() - start)
        order.reverse()

    results = {}
    for name, times in timings.items():
        total = statistics.median(times)
        results[name] = {
            "repeat_seconds": times,
            "median_total_seconds": total,
            "microseconds_per_position": total * 1e6 / len(boards),
            "evaluations_per_second": len(boards) / total,
        }
    return {
        "evaluators": results,
        "repeats": repeats,
        "warmup_positions_per_evaluator": len(warmup),
        "neural_slowdown": (
            results["neural"]["median_total_seconds"]
            / results["material"]["median_total_seconds"]
        ),
    }


def print_summary(results):
    env = results["environment"]
    print("NeuraChess Evaluator Benchmark")
    print(f"\nCheckpoint: {Path(results['checkpoint']['path']).name}")
    print(f"Positions: {results['samples']:,}")
    print("Dataset split: Validation")
    print(
        f"Terminal or claimable-draw positions skipped: {results['dataset']['terminal_positions_skipped']}"
    )
    print(
        f"CPU threads: {env['torch_threads']} intra-op, {env['torch_interop_threads']} inter-op"
    )

    if "accuracy" in results:
        accuracy = results["accuracy"]
        print("\nACCURACY")
        print_comparison(
            accuracy["evaluators"],
            (
                ("MAE (cp)", "mae_cp"),
                ("RMSE (cp)", "rmse_cp"),
                ("Bias (cp)", "bias_cp"),
            ),
        )
        print(f"\nNeural better on: {accuracy['neural_better_pct']:.2f}% of positions")
        print(
            "\nStockfish bucket         Count     Material MAE / Hit %     Neural MAE / Hit %"
        )
        for bucket in accuracy["buckets"]:
            stats = bucket["evaluators"]
            values = []
            for name in ("material", "neural"):
                if name in stats:
                    mae = stats[name]["mae_cp"]
                    hit = stats[name]["bucket_accuracy_pct"]
                    values.append(f"{mae:,.2f} cp / {hit:.2f}%")
                else:
                    values.append("—")
            print(
                f"{bucket['name']:<20}{bucket['positions']:>10,}{values[0]:>25}{values[1]:>23}"
            )

    if "speed" in results:
        speed = results["speed"]
        print(f"\nSPEED (median of {speed['repeats']} repeats)")
        print_comparison(
            speed["evaluators"],
            (
                ("Total time (s)", "median_total_seconds"),
                ("Time per position (µs)", "microseconds_per_position"),
                ("Evaluations/second", "evaluations_per_second"),
            ),
        )
        print(f"\nNeural slowdown: {speed['neural_slowdown']:.2f}x")


def print_comparison(evaluators, rows):
    print(f"{'':<26}{'Material':>14}{'Neural':>14}")
    for label, key in rows:
        precision = 6 if key == "median_total_seconds" else 2
        material = evaluators["material"][key]
        neural = evaluators["neural"][key]
        print(f"{label:<26}{material:>14,.{precision}f}{neural:>14,.{precision}f}")


def save_results(results, directory):
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import pyplot as plt

    directory.mkdir(parents=True, exist_ok=True)
    (directory / "evaluator_benchmark.json").write_text(
        json.dumps(results, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    if "accuracy" in results:
        metrics = results["accuracy"]["evaluators"]
        fig, ax = plt.subplots(layout="constrained")
        for name, offsets in (("material", [-0.2, 0.8]), ("neural", [0.2, 1.2])):
            ax.bar(
                offsets,
                [metrics[name]["mae_cp"], metrics[name]["rmse_cp"]],
                width=0.4,
                label=name.title(),
            )
        ax.set(
            xticks=[0, 1],
            xticklabels=["MAE", "RMSE"],
            ylabel="Error (centipawns)",
            title="Evaluator accuracy on validation positions",
        )
        ax.legend()
        fig.savefig(directory / "evaluator_accuracy.png", dpi=150)
        plt.close(fig)

    if "speed" in results:
        metrics = results["speed"]["evaluators"]
        fig, ax = plt.subplots(layout="constrained")
        ax.bar(
            ["Material", "Neural"],
            [
                metrics[name]["evaluations_per_second"]
                for name in ("material", "neural")
            ],
        )
        ax.set(
            ylabel="Evaluations per second",
            title="Single-position evaluation throughput",
        )
        fig.savefig(directory / "evaluator_speed.png", dpi=150)
        plt.close(fig)


def positive_int(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return number


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument(
        "--checkpoint", type=Path, required=True, help="Path to the trained checkpoint"
    )
    parser.add_argument(
        "--samples", type=positive_int, default=5000, help="Validation positions to use"
    )
    parser.add_argument(
        "--repeats", type=positive_int, default=5, help="Timing repeats per evaluator"
    )
    parser.add_argument("--seed", type=int, default=42, help="Validation sampling seed")
    parser.add_argument(
        "--benchmark",
        choices=("both", "accuracy", "speed"),
        default="both",
        help="Which comparison to run",
    )
    args = parser.parse_args()

    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)
    try:
        neural, checkpoint = load_neural(args.checkpoint)
        positions, dataset = load_positions(args.samples, args.seed)
        evaluators = {"material": evaluate_material, "neural": neural.evaluate}
        results = {
            "checkpoint": checkpoint,
            "dataset": dataset,
            "samples": len(positions),
            "sample_seed": args.seed,
            "environment": {
                "device": "cpu",
                "platform": platform.platform(),
                "processor": platform.processor() or platform.machine(),
                "python": platform.python_version(),
                "torch": str(torch.__version__),
                "python_chess": chess.__version__,
                "torch_threads": torch.get_num_threads(),
                "torch_interop_threads": torch.get_num_interop_threads(),
            },
        }
        if args.benchmark in ("both", "accuracy"):
            results["accuracy"] = benchmark_accuracy(positions, evaluators)
        if args.benchmark in ("both", "speed"):
            results["speed"] = benchmark_speed(
                [board for board, _ in positions], evaluators, args.repeats
            )
        save_results(results, RESULTS)
    except (OSError, ValueError, RuntimeError) as error:
        parser.exit(1, f"Benchmark error: {error}\n")

    print_summary(results)
    print(f"\nResults saved to {RESULTS}")


if __name__ == "__main__":
    main()
