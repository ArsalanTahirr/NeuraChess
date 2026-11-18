import math
import time

import chess

from neurachess.evaluation import evaluate
from neurachess.move_ordering import order_moves
from neurachess.quiescence import quiescence
from neurachess.search_utils import SearchTimeout, check_timeout
from neurachess.transposition import TranspositionTable, TTEntry, TTFlag, position_key


def minimax(board: chess.Board, depth: int) -> int:
    if depth == 0 or board.is_game_over():
        return evaluate(board)

    scores = []
    for move in board.legal_moves:
        board.push(move)
        scores.append(minimax(board, depth - 1))
        board.pop()

    if board.turn == chess.WHITE:
        return max(scores)
    return min(scores)


def alpha_beta(board: chess.Board, depth: int, alpha: float, beta: float) -> int:
    if depth == 0 or board.is_game_over():
        return evaluate(board)

    if board.turn == chess.WHITE:
        best = float("-inf")
        for move in order_moves(board):
            board.push(move)
            score = alpha_beta(board, depth - 1, alpha, beta)
            board.pop()
            best = max(best, score)
            alpha = max(alpha, best)
            if alpha >= beta:
                break
        return best

    best = float("inf")
    for move in order_moves(board):
        board.push(move)
        score = alpha_beta(board, depth - 1, alpha, beta)
        board.pop()
        best = min(best, score)
        beta = min(beta, best)
        if alpha >= beta:
            break
    return best


def find_best_move(board: chess.Board, depth: int) -> chess.Move | None:
    if depth < 1:
        raise ValueError("depth must be at least 1")
    if board.is_game_over():
        return None

    white_to_move = board.turn == chess.WHITE
    best_move = None
    best_score = None

    for move in board.legal_moves:
        board.push(move)
        score = minimax(board, depth - 1)
        board.pop()

        if (
            best_score is None
            or (white_to_move and best_score < score)
            or (not white_to_move and best_score > score)
        ):
            best_score = score
            best_move = move

    return best_move


def negamax_ab(board: chess.Board, depth: int, alpha: float, beta: float) -> int:
    if depth == 0 or board.is_game_over():
        color = 1 if board.turn == chess.WHITE else -1
        return color * evaluate(board)

    best = float("-inf")
    for move in order_moves(board):
        board.push(move)
        score = -negamax_ab(board, depth - 1, -beta, -alpha)
        board.pop()

        best = max(best, score)
        alpha = max(alpha, score)
        if alpha >= beta:
            break

    return best


def negamax_best_move(board: chess.Board, depth: int) -> tuple[chess.Move | None, int]:
    if depth < 1:
        raise ValueError("depth must be at least 1")

    color = 1 if board.turn == chess.WHITE else -1
    if board.is_game_over():
        return None, color * evaluate(board)

    alpha = float("-inf")
    beta = float("inf")

    best_score = float("-inf")
    best_move = None

    for move in order_moves(board):
        board.push(move)
        score = -negamax_ab(board, depth - 1, -beta, -alpha)
        board.pop()

        if score > best_score:
            best_score = score
            best_move = move

        alpha = max(alpha, best_score)
        if alpha >= beta:
            break

    return best_move, best_score


def iterative_deepening(
    board: chess.Board, max_depth: int
) -> tuple[chess.Move | None, int]:
    if max_depth < 1:
        raise ValueError("max_depth must be at least 1")

    best_move = None
    best_score = 0

    for depth in range(1, max_depth + 1):
        best_move, best_score = negamax_best_move(board, depth)

    return best_move, best_score


def negamax_ab_timed(
    board: chess.Board,
    depth: int,
    alpha: float,
    beta: float,
    deadline: float,
    tt: TranspositionTable | None = None,
) -> int:
    check_timeout(deadline)

    if board.is_game_over():
        color = 1 if board.turn == chess.WHITE else -1
        return color * evaluate(board)

    if depth == 0:
        return quiescence(board, alpha, beta, deadline)

    entry, key = None, None
    if tt is not None:
        key = position_key(board)
        entry = tt.get(key)

        if entry is not None and entry.depth >= depth:
            if entry.flag == TTFlag.EXACT:
                return entry.score

            if entry.flag == TTFlag.LOWERBOUND:
                alpha = max(alpha, entry.score)

            elif entry.flag == TTFlag.UPPERBOUND:
                beta = min(beta, entry.score)

            if alpha >= beta:
                return entry.score

    alpha_start = alpha
    beta_start = beta

    best = float("-inf")
    best_move = None

    moves = order_moves(board)

    if entry is not None and entry.best_move in moves:
        moves.remove(entry.best_move)
        moves.insert(0, entry.best_move)

    for move in moves:
        check_timeout(deadline)
        board.push(move)
        try:
            score = -negamax_ab_timed(board, depth - 1, -beta, -alpha, deadline, tt)
        finally:
            board.pop()

        if score > best:
            best = score
            best_move = move

        alpha = max(alpha, score)
        if alpha >= beta:
            break

    if tt is not None and key is not None:
        if best <= alpha_start:
            flag = TTFlag.UPPERBOUND
        elif best >= beta_start:
            flag = TTFlag.LOWERBOUND
        else:
            flag = TTFlag.EXACT

        existing = tt.get(key)

        if existing is None or depth >= existing.depth:
            tt[key] = TTEntry(
                depth=depth,
                score=best,
                flag=flag,
                best_move=best_move,
            )

    return best


def negamax_best_move_timed(
    board: chess.Board,
    depth: int,
    deadline: float,
    tt: TranspositionTable | None = None,
) -> tuple[chess.Move | None, int]:
    if depth < 1:
        raise ValueError("depth must be at least 1")
    check_timeout(deadline)

    color = 1 if board.turn == chess.WHITE else -1
    if board.is_game_over():
        return None, color * evaluate(board)

    alpha = float("-inf")
    beta = float("inf")

    best_score = float("-inf")
    best_move = None

    for move in order_moves(board):
        check_timeout(deadline)
        board.push(move)
        try:
            score = -negamax_ab_timed(board, depth - 1, -beta, -alpha, deadline, tt)
        finally:
            board.pop()

        if score > best_score:
            best_score = score
            best_move = move

        alpha = max(alpha, best_score)
        if alpha >= beta:
            break

    return best_move, best_score


def iterative_deepening_timed(
    board: chess.Board,
    max_depth: int,
    time_limit: float,
) -> tuple[chess.Move | None, int, int]:

    if max_depth < 1:
        raise ValueError("max_depth must be at least 1")

    if not math.isfinite(time_limit) or time_limit <= 0:
        raise ValueError("time_limit must be positive and finite")

    color = 1 if board.turn == chess.WHITE else -1

    if board.is_game_over():
        return None, color * evaluate(board), 0

    best_move = next(iter(board.legal_moves))
    best_score = color * evaluate(board)
    completed_depth = 0

    deadline = time.perf_counter() + time_limit

    tt: TranspositionTable = {}

    for depth in range(1, max_depth + 1):
        try:
            move, score = negamax_best_move_timed(board, depth, deadline, tt)
        except SearchTimeout:
            break

        best_move = move
        best_score = score
        completed_depth = depth

    return best_move, best_score, completed_depth
