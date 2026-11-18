from dataclasses import dataclass
from enum import Enum

import chess
import chess.polyglot


class TTFlag(Enum):
    EXACT = 1
    LOWERBOUND = 2
    UPPERBOUND = 3


@dataclass
class TTEntry:
    depth: int
    score: int
    flag: TTFlag
    best_move: chess.Move | None


PositionKey = tuple[int, int, tuple[chess.Move, ...]]
TranspositionTable = dict[PositionKey, TTEntry]


def position_key(board: chess.Board) -> PositionKey:
    history = (
        tuple(board.move_stack[-board.halfmove_clock :]) if board.halfmove_clock else ()
    )

    return (
        chess.polyglot.zobrist_hash(board),
        board.halfmove_clock,
        history,
    )
