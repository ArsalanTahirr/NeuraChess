from collections.abc import Callable

import chess

from neurachess.evaluation import MATE_SCORE, classical_evaluate
from neurachess.move_ordering import score_move
from neurachess.rules import game_outcome
from neurachess.search_utils import check_timeout


def quiescence(
    board: chess.Board,
    alpha: float,
    beta: float,
    deadline: float | None = None,
    evaluator: Callable = classical_evaluate,
    ply: int = 0,
) -> int:
    if deadline is not None:
        check_timeout(deadline)

    color = 1 if board.turn == chess.WHITE else -1

    outcome = game_outcome(board)
    if outcome is not None:
        return -MATE_SCORE + ply if outcome.winner is not None else 0

    if not board.is_check():
        stand_pat = color * evaluator(board)

        if stand_pat >= beta:
            return stand_pat

        best = stand_pat
        alpha = max(alpha, stand_pat)

        moves = [
            move
            for move in board.legal_moves
            if board.is_capture(move) or move.promotion is not None
        ]
    else:
        best = float("-inf")
        moves = list(board.legal_moves)

    moves.sort(key=lambda m: score_move(board, m), reverse=True)

    for move in moves:
        if deadline is not None:
            check_timeout(deadline)

        board.push(move)

        try:
            score = -quiescence(board, -beta, -alpha, deadline, evaluator, ply + 1)
        finally:
            board.pop()

        best = max(best, score)
        alpha = max(alpha, best)

        if alpha >= beta:
            break

    return best
