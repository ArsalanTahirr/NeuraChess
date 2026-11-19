import chess
import pytest

from neurachess import search as search_module
from neurachess.evaluation import MATE_SCORE, classical_evaluate
from neurachess.move_ordering import order_moves, score_move
from neurachess.search import (
    alpha_beta,
    find_best_move,
    iterative_deepening,
    minimax,
    negamax_ab,
    negamax_best_move,
)

INF = float("inf")
SEARCHES = [minimax, alpha_beta, negamax_ab]
MOVE_SEARCHES = [negamax_best_move, iterative_deepening]
WHITE_WINNING = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"
BLACK_WINNING = "r3k3/8/8/8/8/8/8/4K3 b - - 0 1"
WHITE_IN_CHECK = "4k3/8/8/8/8/8/8/r3K3 w - - 0 1"
WHITE_MATE_IN_ONE = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"
BLACK_MATE_IN_ONE = "r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1"
CHECKMATED = "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"
STALEMATE = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"
CAPTURE = "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1"
PROMOTION = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"
EN_PASSANT = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"

ACTIVE_POSITIONS = [
    pytest.param(chess.STARTING_FEN, id="starting-position"),
    pytest.param(WHITE_WINNING, id="white-winning"),
    pytest.param(BLACK_WINNING, id="black-winning"),
    pytest.param(WHITE_IN_CHECK, id="in-check"),
    pytest.param(WHITE_MATE_IN_ONE, id="white-mate-in-one"),
    pytest.param(BLACK_MATE_IN_ONE, id="black-mate-in-one"),
    pytest.param(CAPTURE, id="capture"),
    pytest.param(PROMOTION, id="promotion"),
    pytest.param(EN_PASSANT, id="en-passant"),
]


def run_search(search, board, depth):
    if search is minimax:
        return search(board, depth)
    return search(board, depth, -INF, INF)


def expected_score(search, board, white_score):
    """Minimax/alpha-beta score White; negamax scores the side to move."""
    if search is negamax_ab and board.turn == chess.BLACK:
        return -white_score
    return white_score


@pytest.mark.parametrize("search", SEARCHES, ids=lambda search: search.__name__)
@pytest.mark.parametrize("fen", [WHITE_WINNING, BLACK_WINNING])
def test_depth_zero_returns_static_evaluation(search, fen):
    board = chess.Board(fen)
    assert run_search(search, board, 0) == expected_score(
        search, board, classical_evaluate(board)
    )


@pytest.mark.parametrize("fen", ACTIVE_POSITIONS)
@pytest.mark.parametrize("depth", [0, 1, 2, 3])
def test_alpha_beta_variants_match_minimax(fen, depth):
    board = chess.Board(fen)
    assert board.is_valid()
    white_score = minimax(board, depth)

    assert alpha_beta(board, depth, -INF, INF) == white_score
    assert negamax_ab(board, depth, -INF, INF) == expected_score(
        negamax_ab, board, white_score
    )


@pytest.mark.parametrize("search", SEARCHES, ids=lambda search: search.__name__)
@pytest.mark.parametrize(
    "fen,white_score",
    [(WHITE_WINNING, 900), (BLACK_WINNING, -500)],
)
def test_winning_side_keeps_material_advantage(search, fen, white_score):
    board = chess.Board(fen)
    assert run_search(search, board, 2) == expected_score(search, board, white_score)


@pytest.mark.parametrize("search", SEARCHES, ids=lambda search: search.__name__)
@pytest.mark.parametrize(
    "fen,white_score",
    [(WHITE_MATE_IN_ONE, MATE_SCORE), (BLACK_MATE_IN_ONE, -MATE_SCORE)],
)
def test_search_finds_mate_in_one(search, fen, white_score):
    board = chess.Board(fen)
    assert run_search(search, board, 1) == expected_score(search, board, white_score)


@pytest.mark.parametrize("search", SEARCHES, ids=lambda search: search.__name__)
@pytest.mark.parametrize("depth", [0, 3])
@pytest.mark.parametrize("mirrored", [False, True], ids=["original", "color-swapped"])
@pytest.mark.parametrize(
    "fen,white_score",
    [
        pytest.param(CHECKMATED, MATE_SCORE, id="checkmate"),
        pytest.param(STALEMATE, 0, id="stalemate"),
        pytest.param("4k3/8/8/8/8/8/8/4K3 w - - 0 1", 0, id="insufficient-material"),
    ],
)
def test_terminal_positions(search, depth, mirrored, fen, white_score):
    board = chess.Board(fen)
    if mirrored:
        board = board.mirror()
        white_score = -white_score
    assert board.is_valid()
    assert board.is_game_over()
    assert run_search(search, board, depth) == expected_score(
        search, board, white_score
    )
    assert find_best_move(board, 2) is None


@pytest.mark.parametrize(
    "search", [*SEARCHES, find_best_move, *MOVE_SEARCHES], ids=lambda f: f.__name__
)
def test_search_preserves_board_and_existing_move_history(search):
    board = chess.Board()
    for move in ["e2e4", "d7d5", "e4d5"]:
        board.push_uci(move)
    original = board.copy(stack=True)

    if search is find_best_move or search in MOVE_SEARCHES:
        search(board, 2)
    else:
        run_search(search, board, 2)

    assert board.fen(en_passant="fen") == original.fen(en_passant="fen")
    assert board.move_stack == original.move_stack
    # Popping verifies that the saved undo state also survived the search.
    while board.move_stack:
        board.pop()
        original.pop()
        assert board.fen(en_passant="fen") == original.fen(en_passant="fen")


@pytest.mark.parametrize("depth", [-2, -1, 0])
def test_find_best_move_rejects_nonpositive_depth(depth):
    with pytest.raises(ValueError, match="depth must be at least 1"):
        find_best_move(chess.Board(), depth)


@pytest.mark.parametrize("fen", ACTIVE_POSITIONS)
def test_best_move_is_legal_and_has_optimal_score(fen):
    board = chess.Board(fen)
    depth = 2
    expected = minimax(board, depth)
    move = find_best_move(board, depth)

    assert move is not None
    assert move in board.legal_moves
    board.push(move)
    assert minimax(board, depth - 1) == expected


@pytest.mark.parametrize("fen", [WHITE_MATE_IN_ONE, BLACK_MATE_IN_ONE])
@pytest.mark.parametrize("depth", [1, 2])
def test_best_move_delivers_checkmate(fen, depth):
    board = chess.Board(fen)
    move = find_best_move(board, depth)

    assert move is not None
    assert move in board.legal_moves
    board.push(move)
    assert board.is_checkmate()


@pytest.mark.parametrize("mirrored", [False, True], ids=["white", "black"])
def test_best_move_captures_hanging_queen(mirrored):
    board = chess.Board(CAPTURE)
    if mirrored:
        board = board.mirror()
    expected = chess.Move.from_uci("a8a7" if mirrored else "a1a2")
    assert find_best_move(board, 2) == expected


@pytest.mark.parametrize("fen", [WHITE_WINNING, BLACK_WINNING, EN_PASSANT])
@pytest.mark.parametrize("depth", [1, 2, 3])
def test_negamax_color_symmetry(fen, depth):
    board = chess.Board(fen)
    assert negamax_ab(board, depth, -INF, INF) == negamax_ab(
        board.mirror(), depth, -INF, INF
    )


@pytest.mark.parametrize("search", [alpha_beta, negamax_ab], ids=lambda f: f.__name__)
@pytest.mark.parametrize("fen", [WHITE_WINNING, BLACK_WINNING, CAPTURE])
def test_narrow_window_bounds_and_board_restoration(search, fen):
    board = chess.Board(fen)
    original = board.copy(stack=True)
    true_score = expected_score(search, board, minimax(board, 2))

    fail_high = search(board, 2, true_score - 200, true_score - 100)
    assert true_score - 100 <= fail_high <= true_score
    fail_low = search(board, 2, true_score + 100, true_score + 200)
    assert true_score <= fail_low <= true_score + 100
    assert search(board, 2, true_score - 1, true_score + 1) == true_score
    assert board == original
    assert board.move_stack == original.move_stack


@pytest.mark.parametrize("search", [alpha_beta, negamax_ab], ids=lambda f: f.__name__)
@pytest.mark.parametrize("fen", [CAPTURE, PROMOTION, EN_PASSANT])
def test_move_ordering_does_not_change_search_score(monkeypatch, search, fen):
    board = chess.Board(fen)
    expected = run_search(search, board, 2)
    monkeypatch.setattr(
        search_module,
        "order_moves",
        lambda board: list(reversed(list(board.legal_moves))),
    )
    assert run_search(search, board, 2) == expected


@pytest.mark.parametrize("fen", [CAPTURE, PROMOTION, EN_PASSANT])
def test_order_moves_preserves_legal_moves_and_board(fen):
    board = chess.Board(fen)
    original = board.copy(stack=True)
    legal_moves = list(board.legal_moves)
    moves = order_moves(board)

    assert len(moves) == len(legal_moves)
    assert set(moves) == set(legal_moves)
    scores = [score_move(board, move) for move in moves]
    assert scores == sorted(scores, reverse=True)
    assert board == original
    assert board.move_stack == original.move_stack


@pytest.mark.parametrize(
    "fen,uci,expected",
    [
        pytest.param(CAPTURE, "a1a2", 8500, id="rook-takes-queen"),
        pytest.param(EN_PASSANT, "e5d6", 900, id="en-passant"),
        pytest.param(PROMOTION, "a7a8q", 900, id="queen-promotion"),
        pytest.param(PROMOTION, "a7a8n", 320, id="knight-promotion"),
        pytest.param(chess.STARTING_FEN, "e2e4", 0, id="quiet-move"),
    ],
)
def test_move_ordering_scores(fen, uci, expected):
    board = chess.Board(fen)
    move = chess.Move.from_uci(uci)
    assert move in board.legal_moves
    assert score_move(board, move) == expected


@pytest.mark.parametrize(
    "fen,uci", [(CAPTURE, "a1a2"), (EN_PASSANT, "e5d6"), (PROMOTION, "a7a8q")]
)
def test_move_ordering_prioritizes_capture_or_promotion(fen, uci):
    board = chess.Board(fen)
    assert order_moves(board)[0] == chess.Move.from_uci(uci)


@pytest.mark.parametrize("search", MOVE_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("depth", [-2, -1, 0])
def test_negamax_move_search_rejects_nonpositive_depth(search, depth):
    parameter = "max_depth" if search is iterative_deepening else "depth"
    with pytest.raises(ValueError, match=f"^{parameter} must be at least 1$"):
        search(chess.Board(), depth)


@pytest.mark.parametrize("search", MOVE_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("fen", ACTIVE_POSITIONS)
@pytest.mark.parametrize("depth", [1, 2, 3])
def test_negamax_move_search_returns_optimal_move_and_score(search, fen, depth):
    board = chess.Board(fen)
    color = 1 if board.turn == chess.WHITE else -1
    expected = color * minimax(board, depth)

    move, score = search(board, depth)

    assert move is not None
    assert move in board.legal_moves
    assert isinstance(score, int)
    assert score == expected
    board.push(move)
    assert color * minimax(board, depth - 1) == score


@pytest.mark.parametrize("search", MOVE_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("mirrored", [False, True], ids=["original", "color-swapped"])
@pytest.mark.parametrize(
    "fen,expected",
    [
        pytest.param(CHECKMATED, -MATE_SCORE, id="checkmate"),
        pytest.param(STALEMATE, 0, id="stalemate"),
        pytest.param("4k3/8/8/8/8/8/8/4K3 w - - 0 1", 0, id="insufficient-material"),
    ],
)
def test_negamax_move_search_returns_no_move_and_terminal_score(
    search, mirrored, fen, expected
):
    board = chess.Board(fen)
    if mirrored:
        board = board.mirror()
    original = board.copy(stack=True)
    assert board.is_game_over()

    assert search(board, 3) == (None, expected)
    assert board == original
    assert board.move_stack == original.move_stack


@pytest.mark.parametrize("search", MOVE_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("fen", [WHITE_MATE_IN_ONE, BLACK_MATE_IN_ONE])
def test_negamax_move_search_delivers_mate_with_positive_score(search, fen):
    board = chess.Board(fen)
    move, score = search(board, 1)

    assert move is not None
    assert move in board.legal_moves
    assert score == MATE_SCORE
    board.push(move)
    assert board.is_checkmate()


@pytest.mark.parametrize("search", MOVE_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("mirrored", [False, True], ids=["white", "black"])
def test_negamax_move_search_respects_requested_depth(search, mirrored):
    # Taking the queen wins material immediately, but the rook on a8 recaptures.
    board = chess.Board("r3k3/8/8/8/8/8/q7/R3K3 w - - 0 1")
    if mirrored:
        board = board.mirror()
    expected_move = chess.Move.from_uci("a8a7" if mirrored else "a1a2")

    assert search(board, 1) == (expected_move, 0)
    assert search(board, 2) == (expected_move, -500)


@pytest.mark.parametrize("max_depth", [1, 3])
def test_iterative_deepening_searches_all_depths_and_returns_final_result(
    monkeypatch, max_depth
):
    board = chess.Board()
    results = [
        (chess.Move.from_uci("e2e4"), 100),
        (chess.Move.from_uci("d2d4"), -50),
        (chess.Move.from_uci("g1f3"), 25),
    ]
    calls = []

    def fake_best_move(current_board, depth):
        assert current_board is board
        calls.append(depth)
        return results[depth - 1]

    monkeypatch.setattr(search_module, "negamax_best_move", fake_best_move)

    assert iterative_deepening(board, max_depth) == results[max_depth - 1]
    assert calls == list(range(1, max_depth + 1))
