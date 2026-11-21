# NeuraChess API

The React app uses `http://localhost:8000` by default. Set `VITE_API_URL` when running or building the frontend to use another API origin. Requests and responses use JSON and camelCase field names. The running backend also serves its OpenAPI schema at `/openapi.json` and interactive docs at `/docs`.

## Position and search formats

- Positions use standard six-field FEN. Returned FENs include an en passant target when a legal en passant capture exists. An imported FEN starts its own history.
- Moves use lowercase UCI such as `e2e4` or `e7e8q`. Standard castling uses the king's starting and ending squares, for example `e1g1`. Move responses also include SAN.
- `evaluationMode` is `material` or `neural`, defaulting to `material`. Neural mode loads the configured checkpoint lazily and shares one CPU evaluator per server process.
- When Material search scores moves equally, its move ordering favors fresh positions, castling, central pawn moves, and minor-piece development. The displayed score remains a material evaluation.
- `maxDepth` is 1–6 plies with a default of 4. `timeLimitMs` is 1–5,000 milliseconds with a default of 1,200. `timeMs` measures the search in milliseconds, excluding checkpoint loading and HTTP overhead.

## Endpoints

| Method and path | JSON request | Successful response |
| --- | --- | --- |
| `GET /health` | — | `status: "ok"`, `engineName`, supported `evaluationModes`, `maxDepth` and `maxTimeMs`. |
| `POST /move` | `fen` and optional search fields | Search result for the best move. |
| `POST /analyze` | Same as `/move` | Same search result. Both routes leave game sessions untouched. |
| `POST /games` | Optional `playerColor` (`white` by default or `black`), `fen` and search fields. Send `{}` for defaults. | Game snapshot with HTTP 201. The default position is the standard starting position. |
| `GET /games/{id}` | — | Current game snapshot, including move history. |
| `POST /games/{id}/moves` | `revision`, `move` | Snapshot after validating and applying the player's move. |
| `POST /games/{id}/engine-move` | `revision` | Snapshot after searching and applying the engine's move. Request this when the engine is to move, including at the start of a game when the player picks Black. |
| `POST /games/{id}/undo` | `revision` | Snapshot after undoing the last player move and any engine reply, or after clearing a resignation. Black's engine-played opening move stays in the ledger. |
| `POST /games/{id}/reset` | `revision`, optional `fen` and optional `settings` | Snapshot with a cleared history and outcome. The starting position is used when `fen` is omitted. Omit `settings` to keep them, or provide game options (`playerColor` and search fields) to replace them. |
| `PATCH /games/{id}/settings` | `revision`, `search` containing the fields to change | Snapshot with updated search settings. Omitted fields keep their current values. |
| `POST /games/{id}/resign` | `revision` | Snapshot with a resignation outcome. |

### Search result

```json
{
  "fen": "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
  "evaluationMode": "material",
  "move": "a1a8",
  "san": "Ra8#",
  "scoreCp": null,
  "mate": { "winner": "white", "plies": 1 },
  "depth": 1,
  "timeMs": 1,
  "status": "completed"
}
```

`fen` describes the position at the root of the search. In a game snapshot, `lastSearch.fen` is therefore the position immediately before the engine's recorded move.

`scoreCp` is a number in **White-relative centipawns**, where 100 centipawns equals one pawn. Positive scores favor White regardless of who is moving or which side the player chose. The UI displays this number in pawns. For mate scores, `scoreCp` is null and `mate` names the winning color and the distance in plies. Zero plies means the position is already checkmate. For finite evaluations and terminal draws, `mate` is null.

`depth` counts fully completed iterations. `completed` means the requested depth was reached. `time-limit` returns the deepest completed result. If the clock expires before the first iteration completes, depth is zero and the existing search's legal fallback and static score are returned. A `terminal` position returns null for move and SAN, depth zero and a mate score or draw score of zero. Principal variations, node counts and MultiPV are unavailable.

### Game snapshot

A snapshot includes `id` (UUID), `revision` (integer), `settings`, `initialFen`, `fen`, `turn` (`w` or `b`), `isCheck`, `outcome`, `moveHistory` and `lastSearch`.

- `moveHistory` is ordered chronologically. Each entry has `san`, `uci`, the resulting `fen`, `moveNumber` from the board, `color` (`w` or `b`), `captured` (a FEN piece symbol or null) and `timeMs` (null for player moves).
- `outcome` is null for an active game. A finished game has `result` (`white`, `black` or `draw`), `winner` (`white`, `black` or null), and `reason`. Reasons include `checkmate`, `stalemate`, `resignation`, `insufficient-material`, `threefold-repetition`, `fivefold-repetition`, `fifty-move` and `seventyfive-move`. Play automatically adjudicates a draw when the current position reaches threefold repetition or fifty moves. FEN analysis has no repetition history preceding that FEN.
- `lastSearch` contains the search result after a successful engine move and is cleared by a player move, undo, reset or settings update. The UI shows its thinking indicator while a request is pending and uses the returned depth and status when it finishes.

Every successful mutation increments the revision. A search runs on a copy that includes the game's full move stack. The server checks the revision again before applying its result. A concurrent mutation can make a response stale. Clients can fetch the latest snapshot using `GET /games/{id}`.

## Errors

```json
{
  "detail": {
    "code": "illegal_move",
    "message": "That move is illegal in this position."
  }
}
```

| HTTP status | Error codes |
| --- | --- |
| 400 | `invalid_fen`, `illegal_move` |
| 404 | `game_not_found` |
| 409 | `finished_game`, `wrong_turn`, `nothing_to_undo`, `stale_game`, `search_in_progress` |
| 422 | `invalid_uci`, `invalid_request` for unsupported settings and other request validation errors |
| 500 | `search_failed` |
| 503 | `neural_unavailable`, `engine_busy` |

The frontend also reports connection failures and HTTP request timeouts. A normal search time cutoff is represented by the successful `time-limit` status.

Sessions live in process memory and are lost when the server restarts. Run a single Uvicorn worker. Search runs off the event loop. At most two searches can run concurrently, and a duplicate engine request for the same revision receives `search_in_progress`.
