# NeuraChess Engine API Contract

This document specifies the HTTP REST API interface proposed for the future NeuraChess FastAPI backend. It serves as the formal boundary between the React/TypeScript frontend and the PyTorch/Python chess engine.

---

## 1. Overview & Base URL

- **Default Base URL:** `http://localhost:8000` (Configurable via `VITE_API_URL` environment variable)
- **Protocol:** HTTP/1.1 or HTTP/2
- **Data Exchange Format:** `application/json`
- **Error Format:** Standard RFC 7807 Problem Details or `{ "detail": string }`

---

## 2. Endpoints

### 2.1 Engine Health & Capabilities

Checks availability of the Python backend and retrieves engine metadata and supported capabilities.

- **Method:** `GET`
- **Path:** `/health`
- **Response Status:** `200 OK`

#### Response Body (`EngineCapabilities`):
```json
{
  "supportsAnalysis": true,
  "supportsEvaluation": true,
  "supportsMultiPV": true,
  "maxDepth": 8,
  "engineName": "NeuraChess Neural Core",
  "engineVersion": "0.1.0",
  "mode": "neural"
}
```

| Field | Type | Description |
|---|---|---|
| `supportsAnalysis` | boolean | Whether asynchronous position analysis is enabled |
| `supportsEvaluation` | boolean | Whether neural centipawn evaluation is available |
| `supportsMultiPV` | boolean | Whether multi-principal variation search is supported |
| `maxDepth` | integer | Maximum supported search ply depth |
| `engineName` | string | Engine identifier name |
| `engineVersion` | string | Engine release semantic version |
| `mode` | string | Operating mode: `"demo"` \| `"neural"` \| `"full"` |

---

### 2.2 Best Move Request

Requests the engine to calculate and return the optimal move from a given board state.

- **Method:** `POST`
- **Path:** `/move`
- **Request Headers:** `Content-Type: application/json`

#### Request Body (`BestMoveRequest`):
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "timeLimit": 1500,
  "maxDepth": 4,
  "multiPV": 1
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `fen` | string | Yes | — | Standard Forsyth-Edwards Notation of the current board |
| `timeLimit` | integer | No | `1200` | Search time cutoff budget in milliseconds |
| `maxDepth` | integer | No | `4` | Maximum iterative deepening search ply depth |
| `multiPV` | integer | No | `1` | Number of principal variations to compute |

#### Response Body (`BestMoveResponse`):
```json
{
  "move": "e2e4",
  "score": 35,
  "depth": 4,
  "nodes": 4210,
  "time": 842,
  "pv": ["e2e4", "c7c5", "g1f3", "d7d6"],
  "mateIn": null
}
```

| Field | Type | Description |
|---|---|---|
| `move` | string | Best move in UCI format (e.g. `"e2e4"`, `"e7e8q"` for promotion) |
| `score` | integer \| null | Evaluation score in centipawns from mover's perspective |
| `depth` | integer \| null | Search depth reached before timeout or terminal node |
| `nodes` | integer \| null | Total search nodes explored |
| `time` | integer \| null | Actual wall-clock time spent in milliseconds |
| `pv` | string[] \| null | Principal variation move list in UCI format |
| `mateIn` | integer \| null | Number of plies to forced checkmate (positive if winning, negative if losing), or null |

---

### 2.3 Position Analysis Request

Performs deep position evaluation without executing a game turn.

- **Method:** `POST`
- **Path:** `/analyze`
- **Request Headers:** `Content-Type: application/json`

#### Request Body (`AnalysisRequest`):
```json
{
  "fen": "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
  "depth": 6,
  "multiPV": 1
}
```

#### Response Body (`AnalysisResponse`):
```json
{
  "fen": "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
  "score": 45,
  "depth": 6,
  "nodes": 12840,
  "time": 1420,
  "pv": ["b5c6", "d7c6", "f3e5", "d8d4"],
  "mateIn": null,
  "evaluation": "centipawn"
}
```

| Field | Type | Description |
|---|---|---|
| `fen` | string | The analyzed position FEN |
| `score` | integer \| null | Evaluation score from **White's perspective** in centipawns |
| `depth` | integer \| null | Depth reached |
| `nodes` | integer \| null | Total nodes searched |
| `time` | integer \| null | Search time in ms |
| `pv` | string[] \| null | Principal variation sequence |
| `mateIn` | integer \| null | Plies to mate if checkmate sequence found |
| `evaluation` | string | `"centipawn"` \| `"mate"` \| `"unknown"` |

---

## 3. Error Handling

When the engine backend encounters an illegal position or internal exception, it must return standard HTTP status codes:

- `400 Bad Request`: Invalid FEN syntax or illegal board arrangement.
- `422 Unprocessable Entity`: Request parameters outside acceptable boundaries.
- `503 Service Unavailable`: Model weights not loaded or search thread saturated.

Example Error Response:
```json
{
  "detail": "Invalid FEN: en passant square requires legal capture"
}
```

---

## 4. Client Adapter Alignment

The frontend `EngineAdapter` TypeScript interface maps directly to these endpoints:

| TypeScript Method | API Endpoint | Fallback (Demo Mode) |
|---|---|---|
| `healthCheck()` | `GET /health` | Returns `true` |
| `getCapabilities()` | `GET /health` | Returns local demo capability object (`mode: 'demo'`) |
| `getBestMove(req)` | `POST /move` | Evaluates legal moves via `chess.js` heuristics |
| `analyzePosition(req)` | `POST /analyze` | Returns empty metric shell with `evaluation: 'unknown'` |
