import chess
import pytest

from neurachess.evaluation import MATE_SCORE, evaluate
from neurachess.search import alpha_beta, find_best_move, minimax


def test_depth_zero_is_evaluate():
    board = chess.Board()
    assert minimax(board, 0) == evaluate(board)


def test_finds_mate_in_one():
    # White plays Ra8#
    board = chess.Board("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")
    assert minimax(board, 1) == MATE_SCORE


def test_board_unchanged_after_search():
    board = chess.Board()
    original = board.copy(stack=True)

    minimax(board, 2)

    assert board == original
    assert board.move_stack == original.move_stack


def test_depth_zero_raises():
    with pytest.raises(ValueError):
        find_best_move(chess.Board(), 0)


def test_checkmate_returns_none():
    board = chess.Board()
    for move in ["f2f3", "e7e5", "g2g4", "d8h4"]:  # fool's mate
        board.push(chess.Move.from_uci(move))
    assert find_best_move(board, 2) is None


def test_stalemate_returns_none():
    board = chess.Board("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")
    assert find_best_move(board, 2) is None


def test_move_is_legal():
    board = chess.Board()
    move = find_best_move(board, 2)
    assert move in board.legal_moves


def test_board_unchanged_after_find_best_move():
    board = chess.Board()
    original = board.copy(stack=True)

    find_best_move(board, 2)

    assert board == original
    assert board.move_stack == original.move_stack


def test_white_finds_mate_in_one():
    board = chess.Board("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")
    move = find_best_move(board, 1)

    assert move is not None
    board.push(move)
    assert board.is_checkmate()


def test_black_finds_mate_in_one():
    board = chess.Board("r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1")
    move = find_best_move(board, 1)

    assert move is not None
    board.push(move)
    assert board.is_checkmate()


def test_best_move_matches_minimax_score():
    depth = 2
    board = chess.Board()
    move = find_best_move(board, depth)

    board.push(move)
    score_after_move = minimax(board, depth - 1)
    board.pop()

    assert score_after_move == minimax(board, depth)


INF = float("inf")

WHITE_WINNING = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"  # White has an extra queen
BLACK_WINNING = "r3k3/8/8/8/8/8/8/4K3 b - - 0 1"  # Black has an extra rook
WHITE_IN_CHECK = "4k3/8/8/8/8/8/8/r3K3 w - - 0 1"  # rook on a1 checks the king
WHITE_MATE_IN_ONE = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"  # Ra8#
BLACK_MATE_IN_ONE = "r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1"  # Ra1#
STALEMATE = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"
CHECKMATED = (
    "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"  # fool's mate
)

ACTIVE_POSITIONS = [
    WHITE_WINNING,
    BLACK_WINNING,
    WHITE_IN_CHECK,
    WHITE_MATE_IN_ONE,
    BLACK_MATE_IN_ONE,
]


# alpha-beta must give the same score as minimax on every position
@pytest.mark.parametrize("fen", ACTIVE_POSITIONS)
@pytest.mark.parametrize("depth", [0, 1, 2, 3])
def test_alpha_beta_matches_minimax(fen, depth):
    board = chess.Board(fen)
    assert alpha_beta(board, depth, -INF, INF) == minimax(board, depth)


# White / Black winning
def test_white_winning_is_positive():
    assert evaluate(chess.Board(WHITE_WINNING)) > 0


def test_black_winning_is_negative():
    assert evaluate(chess.Board(BLACK_WINNING)) < 0


def test_winning_side_keeps_advantage_after_search():
    assert alpha_beta(chess.Board(WHITE_WINNING), 2, -INF, INF) > 0
    assert alpha_beta(chess.Board(BLACK_WINNING), 2, -INF, INF) < 0


# Side to move is in check
def test_in_check_returns_legal_move():
    board = chess.Board(WHITE_IN_CHECK)
    assert board.is_check()
    move = find_best_move(board, 2)
    assert move in board.legal_moves


# Checkmate available
@pytest.mark.parametrize("fen", [WHITE_MATE_IN_ONE, BLACK_MATE_IN_ONE])
def test_finds_checkmate(fen):
    board = chess.Board(fen)
    move = find_best_move(board, 2)
    board.push(move)
    assert board.is_checkmate()


# Game already over
def test_checkmated_position():
    board = chess.Board(CHECKMATED)
    assert board.is_checkmate()
    assert find_best_move(board, 2) is None
    assert alpha_beta(board, 3, -INF, INF) == -MATE_SCORE  # Black delivered mate


def test_stalemate_position():
    board = chess.Board(STALEMATE)
    assert board.is_stalemate()
    assert find_best_move(board, 2) is None
    assert alpha_beta(board, 3, -INF, INF) == 0
