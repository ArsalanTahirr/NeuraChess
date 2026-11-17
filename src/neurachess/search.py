import chess

from neurachess.evaluation import evaluate
from neurachess.move_ordering import order_moves


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
