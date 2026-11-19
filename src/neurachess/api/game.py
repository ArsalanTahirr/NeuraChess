from dataclasses import dataclass, field
from threading import Lock
from uuid import UUID

import chess

from neurachess.api.errors import ApiError
from neurachess.api.schemas import (
    GameOptions,
    GameState,
    MoveRecord,
    Outcome,
    PlayerColor,
    SearchResult,
)
from neurachess.rules import game_outcome


def parse_fen(fen: str) -> chess.Board:
    try:
        if len(fen.split()) != 6:
            raise ValueError("A complete FEN must contain six fields.")
        board = chess.Board(fen)
    except ValueError as exc:
        raise ApiError(400, "invalid_fen", f"Invalid FEN. {exc}") from exc
    if not board.is_valid():
        raise ApiError(400, "invalid_fen", "FEN describes an illegal chess position.")
    return board


def color_name(color: chess.Color) -> PlayerColor:
    return "white" if color == chess.WHITE else "black"


def board_outcome(board: chess.Board) -> Outcome | None:
    outcome = game_outcome(board)
    if outcome:
        winner = color_name(outcome.winner) if outcome.winner is not None else None
        reason = {
            chess.Termination.CHECKMATE: "checkmate",
            chess.Termination.STALEMATE: "stalemate",
            chess.Termination.INSUFFICIENT_MATERIAL: "insufficient-material",
            chess.Termination.FIVEFOLD_REPETITION: "fivefold-repetition",
            chess.Termination.THREEFOLD_REPETITION: "threefold-repetition",
            chess.Termination.SEVENTYFIVE_MOVES: "seventyfive-move",
            chess.Termination.FIFTY_MOVES: "fifty-move",
        }[outcome.termination]
        return Outcome(result=winner or "draw", winner=winner, reason=reason)
    return None


@dataclass
class Game:
    id: UUID
    settings: GameOptions
    board: chess.Board
    revision: int = 0
    history: list[MoveRecord] = field(default_factory=list)
    resignation: Outcome | None = None
    last_search: SearchResult | None = None
    searching_revision: int | None = None
    lock: Lock = field(default_factory=Lock)
    initial_fen: str = field(init=False)

    def __post_init__(self):
        self.initial_fen = self.board.fen()

    @property
    def player_turn(self) -> bool:
        return color_name(self.board.turn) == self.settings.player_color

    def check_revision(self, revision: int) -> None:
        if self.revision != revision:
            raise ApiError(
                409, "stale_game", "The game changed. Review the board and retry."
            )

    def check_active(self) -> None:
        if self.resignation or board_outcome(self.board):
            raise ApiError(409, "finished_game", "This game has already finished.")

    def snapshot(self) -> GameState:
        return GameState(
            id=self.id,
            revision=self.revision,
            settings=self.settings,
            initial_fen=self.initial_fen,
            fen=self.board.fen(),
            turn="w" if self.board.turn else "b",
            is_check=self.board.is_check(),
            outcome=self.resignation or board_outcome(self.board),
            move_history=list(self.history),
            last_search=self.last_search,
        )

    def push(self, move: chess.Move, search: SearchResult | None = None) -> None:
        board = self.board
        if board.is_en_passant(move):
            captured = chess.Piece(chess.PAWN, not board.turn)
        else:
            captured = board.piece_at(move.to_square)

        before = {
            "san": board.san(move),
            "uci": move.uci(),
            "move_number": board.fullmove_number,
            "color": "w" if board.turn else "b",
            "captured": captured.symbol() if captured else None,
            "time_ms": search.time_ms if search else None,
        }
        board.push(move)
        self.history.append(MoveRecord(fen=board.fen(), **before))
        self.last_search = search
        self.revision += 1

    def undo(self) -> None:
        if self.resignation:
            self.resignation = None
        elif not self.history:
            raise ApiError(409, "nothing_to_undo", "There are no moves to undo.")
        else:
            player = "w" if self.settings.player_color == "white" else "b"
            # Return to the last human decision, keeping the engine's opening move.
            plies = 1
            if self.history[-1].color != player:
                if len(self.history) == 1:
                    raise ApiError(
                        409, "nothing_to_undo", "You have not played a move yet."
                    )
                plies = 2
            for _ in range(plies):
                self.board.pop()
                self.history.pop()
        self.last_search = None
        self.revision += 1

    def reset(self, board: chess.Board, settings: GameOptions | None) -> None:
        self.board = board
        self.initial_fen = board.fen()
        if settings is not None:
            self.settings = settings
        self.history.clear()
        self.resignation = None
        self.last_search = None
        self.revision += 1

    def resign(self) -> None:
        self.check_active()
        winner = "black" if self.settings.player_color == "white" else "white"
        self.resignation = Outcome(result=winner, winner=winner, reason="resignation")
        self.revision += 1
