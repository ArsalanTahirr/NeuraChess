import chess

from neurachess.evaluation import MATE_SCORE, evaluate, evaluate_material


def test_start_position_is_equal():
    assert evaluate_material(chess.Board()) == 0


def test_white_up_a_queen():
    board = chess.Board()
    board.remove_piece_at(chess.D8)
    assert evaluate_material(board) == 900


def test_black_up_a_rook():
    board = chess.Board()
    board.remove_piece_at(chess.A1)
    assert evaluate_material(board) == -500


def test_checkmate_black_wins():
    # Fool's mate: Black checkmates White
    board = chess.Board()
    for move in ["f2f3", "e7e5", "g2g4", "d8h4"]:
        board.push(chess.Move.from_uci(move))
    assert evaluate(board) == -MATE_SCORE


def test_stalemate_is_zero():
    board = chess.Board("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")
    assert evaluate(board) == 0


def test_normal_position_uses_material():
    assert evaluate(chess.Board()) == 0
