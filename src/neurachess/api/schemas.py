from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat
from pydantic.alias_generators import to_camel

PlayerColor = Literal["white", "black"]
Turn = Literal["w", "b"]
EvaluationMode = Literal["material", "neural"]
Fen = Annotated[str, Field(max_length=160)]
Uci = Annotated[str, Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")]
MAX_DEPTH = 6
MAX_TIME_MS = 5000


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid"
    )


class SearchOptions(ApiModel):
    evaluation_mode: EvaluationMode = "material"
    max_depth: int = Field(default=4, ge=1, le=MAX_DEPTH, strict=True)
    time_limit_ms: int = Field(default=1200, ge=1, le=MAX_TIME_MS, strict=True)


class GameOptions(SearchOptions):
    player_color: PlayerColor = "white"


class PositionRequest(SearchOptions):
    fen: Fen


class NewGame(GameOptions):
    fen: Fen | None = None


class GameRevision(ApiModel):
    revision: int = Field(ge=0, strict=True)


class PlayerMove(GameRevision):
    move: Uci


class ResetGame(GameRevision):
    fen: Fen | None = None
    settings: GameOptions | None = None


class UpdateSearch(GameRevision):
    search: SearchOptions


class MateScore(ApiModel):
    winner: PlayerColor
    plies: int = Field(ge=0)


class SearchResult(ApiModel):
    fen: Fen
    evaluation_mode: EvaluationMode
    move: Uci | None
    san: str | None
    score_cp: FiniteFloat | None
    mate: MateScore | None
    depth: int = Field(ge=0)
    time_ms: int = Field(ge=0)
    status: Literal["completed", "time-limit", "terminal"]


class Outcome(ApiModel):
    result: Literal["white", "black", "draw"]
    winner: PlayerColor | None
    reason: Literal[
        "checkmate",
        "stalemate",
        "resignation",
        "insufficient-material",
        "threefold-repetition",
        "fivefold-repetition",
        "fifty-move",
        "seventyfive-move",
    ]


class MoveRecord(ApiModel):
    san: str
    uci: Uci
    fen: Fen
    move_number: int
    color: Turn
    captured: str | None
    time_ms: int | None


class GameState(ApiModel):
    id: UUID
    revision: int
    settings: GameOptions
    initial_fen: Fen
    fen: Fen
    turn: Turn
    is_check: bool
    outcome: Outcome | None
    move_history: list[MoveRecord]
    last_search: SearchResult | None


class Health(ApiModel):
    status: Literal["ok"] = "ok"
    engine_name: str = "NeuraChess"
    evaluation_modes: tuple[EvaluationMode, EvaluationMode] = ("material", "neural")
    max_depth: int = MAX_DEPTH
    max_time_ms: int = MAX_TIME_MS


class ErrorDetail(ApiModel):
    code: str
    message: str


class ErrorResponse(ApiModel):
    detail: ErrorDetail
