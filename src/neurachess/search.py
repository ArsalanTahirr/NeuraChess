import chess

from neurachess.evaluation import evaluate


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
        for move in board.legal_moves:
            board.push(move)
            score = alpha_beta(board, depth - 1, alpha, beta)
            board.pop()
            best = max(best, score)
            alpha = max(alpha, best)
            if alpha >= beta:
                break
        return best

    best = float("inf")
    for move in board.legal_moves:
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
