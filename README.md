# NeuraChess

NeuraChess is a Python chess engine and web app built to explore how search and position evaluation affect move selection. Play against the engine as either color, or analyze a position from a FEN, a preset, or the analysis board. Both modes let you choose material or neural evaluation and set a depth limit and time budget.

The backend uses **Python, FastAPI, python-chess, PyTorch, and NumPy**. The frontend uses **React 19, TypeScript, Vite, Tailwind CSS 4, and Motion**, with `chess.js` for board previews and `react-chessboard` for rendering.

## Run NeuraChess locally

Use Python 3.12 with `uv`, and Node.js 22 with npm. The included checkpoints let you run neural evaluation without downloading the training data.

Start the backend from the repository root.

```sh
uv sync --locked
uv run --locked uvicorn neurachess.api.app:app --host 127.0.0.1 --port 8000
```

In a second terminal, start the frontend.

```sh
cd frontend
npm ci
npm run dev
```

Open [NeuraChess](http://localhost:5173). In **Play**, choose your color, depth, and evaluator. Use **Settings** to set the search time budget. In **Analysis**, load a position and select **Analyze Position** to see the engine's best move and evaluation.

The backend uses `checkpoints/model_v001.pt` for **Neural** mode when that file is available and falls back to `checkpoints/nnue_v001.pt` otherwise. To select NNUE explicitly, start the backend with the following command and choose **Neural** in the app.

```sh
NEURACHESS_CHECKPOINT=checkpoints/nnue_v001.pt \
  uv run --locked uvicorn neurachess.api.app:app --host 127.0.0.1 --port 8000
```

Use one Uvicorn worker. The backend stores games in memory, so a browser refresh can resume a game while the same backend process is running. If you serve the frontend and API from different origins, set `VITE_API_URL` in the frontend and `NEURACHESS_CORS_ORIGINS` in the backend. See the [API contract](frontend/API_CONTRACT.md) and [frontend guide](frontend/README.md).

## Search engine

The engine started with minimax and a material evaluator. Search developed in this order.

1. Minimax
2. Alpha-beta pruning
3. Alpha-beta with move ordering
4. Negamax with alpha-beta pruning
5. Timed negamax with iterative deepening
6. Timed negamax with quiescence search
7. Timed negamax with quiescence search and a transposition table

The API uses the last version. Iterative deepening returns the result from the deepest completed iteration before the deadline. Quiescence search continues through captures, promotions, and check evasions at the depth boundary. The transposition table reuses search scores, bounds, and best moves for positions encountered within the same search. [Search implementation](src/neurachess/search.py)

## Position evaluators

### Material baseline

The original evaluator sums fixed piece values for each side and returns White's material advantage in centipawns. It remains available as the **Material** mode. [Material evaluator](src/neurachess/evaluation.py)

### Multilayer perceptron

The MLP was the main neural experiment. It takes **773 input features** and predicts a single White-relative position score.

- **768 piece-square features** come from 12 binary `8 × 8` planes, one for each combination of piece type and color.
- **5 flags** encode whether White is to move and whether each side can castle kingside or queenside.

| Training setting | Value |
| --- | --- |
| Architecture | `773 → 512 → 256 → 128 → 1` |
| Hidden layers | Linear → LayerNorm → GELU → Dropout |
| Dropout | `0.1` |
| Loss | Huber loss with `delta=1.0` |
| Optimizer | AdamW with learning rate `1e-3` and weight decay `0.01` |
| Training schedule | Up to 40 epochs, with early stopping after 4 epochs without improvement in validation MAE |

The included MLP checkpoint comes from epoch 25, which reached a validation MAE of **188.0 centipawns**. During search, the CPU evaluator tracks which binary features changed and updates the first layer's weighted sum incrementally. PyTorch runs the remaining layers. [Training notebook](notebooks/01_neural_experiments.ipynb), [MLP inference](src/neurachess/neural/mlp_inference.py)

### Experimental NNUE

The NNUE evaluator was a late experiment in faster CPU inference. Each king's location selects one of six regions for its side's piece-square features. The model combines two 256-value vectors in a 32-unit hidden layer and predicts a correction to the material score. During search, integer accumulators update as features change. When a king crosses a region boundary, the accumulator for that perspective is rebuilt. [NNUE model](src/neurachess/neural/nnue.py), [NNUE inference](src/neurachess/neural/nnue_inference.py)

## Benchmarks

### Search algorithms

The search benchmark compares minimax, alpha-beta, and ordered alpha-beta at depths 1 through 3. It checks that the scores agree and reports visited nodes, leaf evaluations, cutoffs, and median runtime.

On the tactical middlegame position at depth 3, minimax visited **99,950** nodes, alpha-beta visited **11,503**, and ordered alpha-beta visited **2,464**. All three returned the same score.

```sh
uv run --locked python -m benchmarks.benchmark_search
```

### Evaluation accuracy and head-to-head play

| Comparison | Sample | Mean absolute error against Stockfish labels |
| --- | --- | --- |
| Material vs. MLP | 5,000 positions sampled from the validation split | Material **317.0 cp**, MLP **186.2 cp** |
| MLP vs. NNUE | 100,000 positions from the held-out test split | MLP **189.3 cp**, NNUE **227.4 cp** |

The MLP more closely matched the Stockfish labels on the held-out test split. In a replay of the head-to-head benchmark, **NNUE won three games and drew one**. The match used the Italian Game and Queen's Gambit, swapped colors for each opening, and used a depth cap of 4 plies and a 1.2-second budget per move. NNUE averaged a higher completed depth in each of the four games. [Saved material–MLP results](benchmarks/results/evaluator_benchmark.json), [Match harness](benchmarks/nnue_match.py)

```sh
uv run --locked python benchmarks/evaluator_benchmark.py \
  --checkpoint checkpoints/model_v001.pt

uv run --locked python benchmarks/nnue_match.py
```

The evaluator benchmark writes charts and JSON to `benchmarks/results/`. Its timing measures direct evaluator calls. The match benchmark uses the incremental inference paths used by the app.

## Data and training

[`scripts/build_dataset.py`](scripts/build_dataset.py) reads selected Parquet row groups from a pinned revision of the Lichess `chess-position-evaluations` dataset on Hugging Face. The default build scans up to 8 million source rows and targets 1 million unique standard-chess positions. It keeps the deepest qualifying evaluation observed for each position, requires a depth of at least 16, excludes positions whose selected evaluation is a mate, and clips White-relative scores to ±1,500 centipawns. Sampling is stratified by game phase and evaluation range.

From the repository root on Linux or macOS, build and encode the dataset.

```sh
uv run --locked python scripts/build_dataset.py
uv run --locked python scripts/preprocess_dataset.py
```

The builder writes `data/chess_positions.parquet` and `data/dataset_report.json`. Preprocessing writes `data/encoded/X.npy` and `data/encoded/y.npy`. The `data/` directory is ignored by Git.

The MLP notebook and NNUE trainer use a seeded 80/10/10 split by position. Related positions can appear in different splits. For MLP experiments, open [the training notebook](notebooks/01_neural_experiments.ipynb). To train a new NNUE checkpoint, use a new output filename.

```sh
uv run --locked python scripts/train_nnue.py --output checkpoints/nnue_v002.pt
```

## Repository layout

| Path | Contents |
| --- | --- |
| [`src/neurachess/`](src/neurachess/) | Search algorithms, evaluation, chess rules, neural inference, and the FastAPI backend |
| [`frontend/`](frontend/) | Browser interface for play, analysis, and settings |
| [`benchmarks/`](benchmarks/) | Search comparisons, evaluator benchmarks, match harness, and saved results |
| [`notebooks/`](notebooks/) | MLP training and evaluation experiments |
| [`checkpoints/`](checkpoints/) | Included MLP and NNUE model weights |
| [`scripts/`](scripts/) | Dataset building, preprocessing, and NNUE training |
| [`tests/`](tests/) | Python tests for the engine, API, data pipeline, and evaluators |
| `data/` | Generated dataset, dataset report, and encoded training arrays |

## Tests and checks

Run the Python tests and lint checks from the repository root.

```sh
uv run --locked pytest
uv run --locked ruff check .
```

Run the frontend tests and build from `frontend/`.

```sh
npm test
npm run build
```

See the [frontend verification guide](frontend/README.md#verification) for browser gameplay checks.

## Development notes

The original tests and inference implementation were written by the project author. Later test development and inference optimization used AI assistance. The frontend was generated with AI using Antigravity. With limited time and compute, the neural work focused on the MLP, with an AI-assisted NNUE added near the end of the project.