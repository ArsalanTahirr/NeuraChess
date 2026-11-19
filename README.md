# NeuraChess

## Build the evaluation dataset

Run this from the repository root on Linux or macOS.

```sh
uv run --locked python scripts/build_dataset.py
```

The default build targets 1,000,000 unique positions and inspects up to 8,000,000 source rows with seed 42. It writes `data/chess_positions.parquet` (Zstandard) and `data/dataset_report.json`.

| Option | Default | Purpose |
| --- | --- | --- |
| `--target-count` | 1,000,000 | Number of unique positions to select |
| `--max-scan-rows` | 8,000,000 | Maximum number of source rows to inspect |
| `--min-depth` | 16 | Minimum accepted Stockfish search depth |
| `--clip-cp` | 1500 | Symmetric clipping limit for `cp` |
| `--seed` | 42 | Seed for the scan plan and within-stratum sampling |
| `--revision` | `8c5285259fdbf3218bf2582de9775dd1378f520b` | Hugging Face revision, resolved to a commit before reading |
| `--output-dir` | `data` | Directory for both output files and temporary build state |

For a smaller live run, use a separate output directory.

```sh
uv run --locked python scripts/build_dataset.py --target-count 1000 --max-scan-rows 10000 --output-dir /tmp/neurachess-sample
```

### Source and labels

The pinned Lichess source has 20 native Parquet shards in the `train` split. Each row is a principal variation. The builder projects `fen` (string), `depth` (uint8), `knodes` (int32), `cp` (nullable int16) and `mate` (nullable int8), and checks the physical types. Lichess stores cache scores from White's perspective and exports the same values. `raw_cp` retains the original centipawn score and `cp` contains the clipped score for either side to move. [Pinned dataset card and files](https://huggingface.co/datasets/Lichess/chess-position-evaluations/tree/8c5285259fdbf3218bf2582de9775dd1378f520b), [Lichess CloudEval schema](https://github.com/lichess-org/api/blob/master/doc/specs/schemas/CloudEval.yaml), [Lichess cache score convention](https://github.com/lichess-org/lila/blob/master/modules/evalCache/src/main/BSONHandlers.scala#L13-L19), [Lichess export code](https://github.com/lichess-org/database/blob/master/src/main/scala/Evals.scala#L80-L93).

The builder validates standard-chess positions with `python-chess`. The position key uses piece placement, active color, castling rights and the en passant square when a capture is legal. Lichess supplies four fields, so the output uses `0 1` for the halfmove and fullmove counters.

For each key, the builder keeps the deepest qualifying evaluation it encountered. At equal depth it prefers more searched nodes, then the best principal variation for the mover. At that tie-break, the mover prefers faster winning mates and slower losing mates. A zero mate value takes precedence over finite scores. Positions whose chosen evaluation is a mate are excluded. Lichess recommends starting with the deepest evaluation and its first principal variation. [Lichess evaluation export notes](https://database.lichess.org/#evals).

### Sampling and report

Evaluation buckets use the White-relative score before clipping.

| Bucket | Range |
| --- | --- |
| `strong_black` | `cp < -500` |
| `moderate_black` | `-500 <= cp < -150` |
| `equal` | `-150 <= cp <= 150` |
| `moderate_white` | `150 < cp <= 500` |
| `strong_white` | `cp > 500` |

The game-phase heuristic weights remaining knights and bishops at 1, rooks at 2, and queens at 4 across both colors. A weight of 8 or less is endgame. A weight of at least 20 with at least 12 pawns and at least four knights or bishops on their respective starting squares is opening. Everything else is middlegame.

The seed shuffles shards and picks a row group from each in turn. A final partial group uses a seeded contiguous slice. Hugging Face range reads fetch the projected columns, including the full projected group for that final slice. The scan budget limits the rows processed, and the report records both the slice and the full group's projected compressed size. A temporary SQLite database holds the best observed evaluation per key across batches. Equal quotas across the 15 strata are capped by availability, with spare quota shared across categories that can fill it. A seeded hash of the canonical key ranks candidates within each stratum. The report records eligible and selected counts, quota shortfalls, filtered rows, duplicates and clipped labels.

Nearby rows can describe related positions and a row-group boundary can cut through a position's set of evaluations. The chosen score is therefore the best qualifying evaluation observed in the selected slices. Stratification deliberately changes the scanned distribution. If the scan yields fewer eligible positions than the target, the builder publishes the available sample and reports the shortfall.

Failed reads are retried without advancing the scan. An interrupted run can be restarted with the same revision and arguments to repeat its scan plan from the beginning. Completed files are staged and renamed individually, and the report includes the Parquet SHA-256 so consumers can check that the two files belong to the same run.
