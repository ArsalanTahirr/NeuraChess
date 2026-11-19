import os
from pathlib import Path
from threading import Lock
from uuid import UUID, uuid4

import chess
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from neurachess.api.engine import Engine
from neurachess.api.errors import ApiError
from neurachess.api.game import Game, parse_fen
from neurachess.api.schemas import (
    ErrorResponse,
    GameOptions,
    GameRevision,
    GameState,
    Health,
    NewGame,
    PlayerMove,
    PositionRequest,
    ResetGame,
    SearchResult,
    UpdateSearch,
)


def create_app(checkpoint_path: Path | None = None) -> FastAPI:
    app = FastAPI(
        title="NeuraChess",
        version="0.1.0",
        responses={422: {"model": ErrorResponse}},
    )
    origins = os.environ.get(
        "NEURACHESS_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            origin.strip() for origin in origins.split(",") if origin.strip()
        ],
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )

    default_checkpoint = Path("checkpoints/model_v001.pt")
    engine = Engine(
        checkpoint_path
        or Path(os.environ.get("NEURACHESS_CHECKPOINT", default_checkpoint))
    )
    games: dict[UUID, Game] = {}
    games_lock = Lock()

    def get_game(game_id: UUID) -> Game:
        with games_lock:
            game = games.get(game_id)
        if game is None:
            raise ApiError(
                404, "game_not_found", "This game is unavailable. Start a new game."
            )
        return game

    @app.exception_handler(RequestValidationError)
    async def validation_error(_, exc: RequestValidationError):
        error = exc.errors()[0]
        field = ".".join(map(str, error["loc"][1:])) or "request"
        code = "invalid_uci" if field == "move" else "invalid_request"
        message = (
            "Use a UCI move such as e2e4 or e7e8q."
            if code == "invalid_uci"
            else f"Invalid {field}. {error['msg']}"
        )
        return JSONResponse(
            status_code=422, content={"detail": {"code": code, "message": message}}
        )

    @app.exception_handler(HTTPException)
    async def http_error(_, exc: HTTPException):
        detail = exc.detail
        if not isinstance(detail, dict):
            detail = {"code": "http_error", "message": str(detail)}
        return JSONResponse(
            status_code=exc.status_code, content={"detail": detail}, headers=exc.headers
        )

    @app.get("/health")
    def health() -> Health:
        return Health()

    @app.post("/move")
    @app.post("/analyze")
    def analyze_position(request: PositionRequest) -> SearchResult:
        return engine.search(parse_fen(request.fen), request)

    @app.post("/games", status_code=201)
    def create_game(request: NewGame) -> GameState:
        board = chess.Board() if request.fen is None else parse_fen(request.fen)
        settings = GameOptions(**request.model_dump(exclude={"fen"}))
        game = Game(uuid4(), settings, board)
        snapshot = game.snapshot()
        with games_lock:
            games[game.id] = game
        return snapshot

    @app.get("/games/{game_id}")
    def read_game(game_id: UUID) -> GameState:
        game = get_game(game_id)
        with game.lock:
            return game.snapshot()

    @app.post("/games/{game_id}/moves")
    def play_move(game_id: UUID, request: PlayerMove) -> GameState:
        game = get_game(game_id)
        with game.lock:
            game.check_revision(request.revision)
            game.check_active()
            if not game.player_turn:
                raise ApiError(409, "wrong_turn", "It is the engine's turn.")
            try:
                move = chess.Move.from_uci(request.move)
            except ValueError as exc:
                raise ApiError(
                    422, "invalid_uci", "Use a UCI move such as e2e4 or e7e8q."
                ) from exc
            if move not in game.board.legal_moves:
                raise ApiError(
                    400, "illegal_move", "That move is illegal in this position."
                )
            game.push(move)
            return game.snapshot()

    @app.post("/games/{game_id}/engine-move")
    def play_engine_move(game_id: UUID, request: GameRevision) -> GameState:
        game = get_game(game_id)
        with game.lock:
            game.check_revision(request.revision)
            game.check_active()
            if game.player_turn:
                raise ApiError(409, "wrong_turn", "It is the player's turn.")
            if game.searching_revision == request.revision:
                raise ApiError(
                    409,
                    "search_in_progress",
                    "The engine is already searching this position.",
                )
            board = game.board.copy(stack=True)
            settings = game.settings
            game.searching_revision = request.revision

        try:
            result = engine.search(board, settings)
            with game.lock:
                game.check_revision(request.revision)
                if result.move is None:
                    raise ApiError(500, "search_failed", "The engine returned no move.")
                game.push(chess.Move.from_uci(result.move), result)
                return game.snapshot()
        finally:
            with game.lock:
                if game.searching_revision == request.revision:
                    game.searching_revision = None

    @app.post("/games/{game_id}/undo")
    def undo_move(game_id: UUID, request: GameRevision) -> GameState:
        game = get_game(game_id)
        with game.lock:
            game.check_revision(request.revision)
            game.undo()
            return game.snapshot()

    @app.post("/games/{game_id}/reset")
    def reset_game(game_id: UUID, request: ResetGame) -> GameState:
        game = get_game(game_id)
        board = chess.Board() if request.fen is None else parse_fen(request.fen)
        with game.lock:
            game.check_revision(request.revision)
            game.reset(board, request.settings)
            return game.snapshot()

    @app.post("/games/{game_id}/resign")
    def resign_game(game_id: UUID, request: GameRevision) -> GameState:
        game = get_game(game_id)
        with game.lock:
            game.check_revision(request.revision)
            game.resign()
            return game.snapshot()

    @app.patch("/games/{game_id}/settings")
    def update_search(game_id: UUID, request: UpdateSearch) -> GameState:
        game = get_game(game_id)
        with game.lock:
            game.check_revision(request.revision)
            game.settings = game.settings.model_copy(
                update=request.search.model_dump(exclude_unset=True)
            )
            game.last_search = None
            game.revision += 1
            return game.snapshot()

    return app


app = create_app()
