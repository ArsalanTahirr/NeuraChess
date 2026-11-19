from pathlib import Path

import chess
import numpy as np
import pandas as pd

from neurachess.neural.encoding import encode_board


def main():
    output = Path("data/encoded")
    output.mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet(
        "data/chess_positions.parquet",
        columns=["fen", "cp"],
    )

    n = len(df)

    X = np.lib.format.open_memmap(
        output / "X.npy",
        mode="w+",
        dtype=np.uint8,
        shape=(n, 773),
    )

    y = np.lib.format.open_memmap(
        output / "y.npy",
        mode="w+",
        dtype=np.float32,
        shape=(n, 1),
    )

    for i, (fen, cp) in enumerate(
        zip(df["fen"], df["cp"])
    ):
        board = chess.Board(fen)

        X[i] = encode_board(board).numpy().astype(np.uint8)
        y[i, 0] = cp / 100.0

        if (i + 1) % 50_000 == 0:
            print(f"Encoded {i + 1:,}/{n:,}", flush=True)

    X.flush()
    y.flush()

    print("Preprocessing complete.")


if __name__ == "__main__":
    main()