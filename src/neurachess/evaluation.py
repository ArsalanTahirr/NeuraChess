import chess

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,  # kings are never captured, so they don't count
}

MATE_SCORE = 100_000

def evaluate_material(board: chess.Board) -> int:
    score = 0
    for piece in board.piece_map().values():
        value = PIECE_VALUES[piece.piece_type]
        score += value if piece.color == chess.WHITE else -value

    return score

def evaluate(board: chess.Board) -> int:
    outcome = board.outcome()
    if outcome is not None:
        if outcome.winner is None:
            return 0
        return MATE_SCORE if outcome.winner == chess.WHITE else -MATE_SCORE

    return evaluate_material(board)