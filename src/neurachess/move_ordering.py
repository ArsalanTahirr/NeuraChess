import chess

from neurachess.evaluation import PIECE_VALUES


def score_move(board: chess.Board, move: chess.Move) -> int:
    score = 0

    attacker = board.piece_at(move.from_square)

    if board.is_capture(move):
        if board.is_en_passant(move):
            victim_type = chess.PAWN
        else:
            victim_type = board.piece_at(move.to_square).piece_type

        score += 10 * PIECE_VALUES.get(victim_type, 0) - PIECE_VALUES.get(
            attacker.piece_type, 0
        )

    if move.promotion:
        score += PIECE_VALUES.get(move.promotion, 0)

    return score


def order_moves(board: chess.Board) -> list[chess.Move]:
    return sorted(board.legal_moves, key=lambda m: score_move(board, m), reverse=True)