import chess
import pytest

from neurachess import search
from neurachess.evaluation import MATE_SCORE, evaluate

INF = float("inf")
WHITE_WINNING = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1"
BLACK_WINNING = "r3k3/8/8/8/8/8/8/4K3 b - - 0 1"
MATE_IN_ONE = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"
CHECKMATED = "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"
STALEMATE = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"
ACTIVE_POSITIONS = [
    WHITE_WINNING,
    BLACK_WINNING,
    MATE_IN_ONE,
    "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1",  # Capture.
    "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",  # Promotion.
    "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",  # En passant.
]
TIMED_SEARCHES = [search.negamax_ab_timed, search.negamax_best_move_timed]


@pytest.fixture
def frozen_clock(monkeypatch):
    monkeypatch.setattr(search.time, "perf_counter", lambda: 100.0)


def run_timed(function, board, depth, deadline):
    if function is search.negamax_ab_timed:
        return function(board, depth, -INF, INF, deadline)
    return function(board, depth, deadline)


def assert_board_restored(board, original):
    assert board.fen(en_passant="fen") == original.fen(en_passant="fen")
    assert board.move_stack == original.move_stack
    # Check the undo states as well as the current position.
    restored = board.copy(stack=True)
    expected = original.copy(stack=True)
    while restored.move_stack:
        restored.pop()
        expected.pop()
        assert restored.fen(en_passant="fen") == expected.fen(en_passant="fen")


@pytest.mark.parametrize("deadline", [99.0, 100.0])
def test_check_timeout_raises_at_or_after_deadline(frozen_clock, deadline):
    with pytest.raises(search.SearchTimeout):
        search.check_timeout(deadline)


def test_check_timeout_returns_before_deadline(frozen_clock):
    assert search.check_timeout(100.1) is None


@pytest.mark.parametrize("fen", ACTIVE_POSITIONS)
@pytest.mark.parametrize("depth", [0, 1, 2, 3])
def test_timed_negamax_matches_untimed_search(frozen_clock, fen, depth):
    board = chess.Board(fen)
    expected = search.negamax_ab(board, depth, -INF, INF)
    assert search.negamax_ab_timed(board, depth, -INF, INF, 101.0) == expected


@pytest.mark.parametrize("fen", ACTIVE_POSITIONS)
@pytest.mark.parametrize("depth", [1, 2])
def test_timed_best_move_matches_untimed_search(frozen_clock, fen, depth):
    board = chess.Board(fen)
    assert search.negamax_best_move_timed(board, depth, 101.0) == (
        search.negamax_best_move(board, depth)
    )


@pytest.mark.parametrize("fen", [WHITE_WINNING, BLACK_WINNING])
def test_timed_negamax_narrow_window_bounds(frozen_clock, fen):
    board = chess.Board(fen)
    score = search.negamax_ab(board, 2, -INF, INF)
    fail_high = search.negamax_ab_timed(board, 2, score - 200, score - 100, 101.0)
    fail_low = search.negamax_ab_timed(board, 2, score + 100, score + 200, 101.0)
    assert score - 100 <= fail_high <= score
    assert score <= fail_low <= score + 100
    assert search.negamax_ab_timed(board, 2, score - 1, score + 1, 101.0) == score


@pytest.mark.parametrize("function", TIMED_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("fen", [chess.STARTING_FEN, CHECKMATED])
def test_expired_search_raises_even_on_terminal_board(frozen_clock, function, fen):
    board = chess.Board(fen)
    with pytest.raises(search.SearchTimeout):
        run_timed(function, board, 2, 100.0)


def test_expired_depth_zero_search_raises(frozen_clock):
    with pytest.raises(search.SearchTimeout):
        search.negamax_ab_timed(chess.Board(), 0, -INF, INF, 100.0)


@pytest.mark.parametrize("function", TIMED_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("expire_on_check", [1, 2, 3, 4, 5, 8])
def test_timeout_restores_board_at_different_recursion_points(
    monkeypatch, function, expire_on_check
):
    board = chess.Board()
    for uci in ["e2e4", "d7d5", "e4d5"]:
        board.push_uci(uci)
    original = board.copy(stack=True)
    checks = 0

    def clock():
        nonlocal checks
        checks += 1
        return 101.0 if checks >= expire_on_check else 100.0

    monkeypatch.setattr(search.time, "perf_counter", clock)
    with pytest.raises(search.SearchTimeout):
        run_timed(function, board, 3, 101.0)

    assert checks == expire_on_check
    assert_board_restored(board, original)


@pytest.mark.parametrize("function", TIMED_SEARCHES, ids=lambda f: f.__name__)
def test_timed_search_restores_board_after_success(frozen_clock, function):
    board = chess.Board()
    for uci in ["e2e4", "d7d5", "e4d5"]:
        board.push_uci(uci)
    original = board.copy(stack=True)
    run_timed(function, board, 2, 101.0)
    assert_board_restored(board, original)


@pytest.mark.parametrize("function", TIMED_SEARCHES, ids=lambda f: f.__name__)
def test_timed_search_restores_board_and_propagates_evaluation_errors(
    frozen_clock, monkeypatch, function
):
    board = chess.Board()
    board.push_uci("e2e4")
    original = board.copy(stack=True)

    def broken_evaluation(current_board):
        raise RuntimeError("evaluation failed")

    monkeypatch.setattr(search, "evaluate", broken_evaluation)
    with pytest.raises(RuntimeError, match="evaluation failed"):
        run_timed(function, board, 2, 101.0)
    assert_board_restored(board, original)


@pytest.mark.parametrize("depth", [-2, -1, 0])
def test_timed_best_move_rejects_nonpositive_depth(frozen_clock, depth):
    with pytest.raises(ValueError, match="^depth must be at least 1$"):
        search.negamax_best_move_timed(chess.Board(), depth, 101.0)


@pytest.mark.parametrize("function", TIMED_SEARCHES, ids=lambda f: f.__name__)
@pytest.mark.parametrize("mirrored", [False, True], ids=["original", "color-swapped"])
@pytest.mark.parametrize(
    "fen,score",
    [
        (CHECKMATED, -MATE_SCORE),
        (STALEMATE, 0),
        ("4k3/8/8/8/8/8/8/4K3 w - - 0 1", 0),
    ],
)
def test_timed_search_terminal_scores(frozen_clock, function, mirrored, fen, score):
    board = chess.Board(fen)
    if mirrored:
        board = board.mirror()
    result = run_timed(function, board, 3, 101.0)
    assert result == (score if function is search.negamax_ab_timed else (None, score))


@pytest.mark.parametrize("max_depth", [-2, -1, 0])
def test_timed_iterative_deepening_rejects_nonpositive_depth(max_depth):
    with pytest.raises(ValueError, match="^max_depth must be at least 1$"):
        search.iterative_deepening_timed(chess.Board(), max_depth, 1.0)


@pytest.mark.parametrize("time_limit", [0.0, -1.0, INF, -INF, float("nan")])
@pytest.mark.parametrize("fen", [chess.STARTING_FEN, CHECKMATED])
def test_timed_iterative_deepening_rejects_invalid_time_limit(time_limit, fen):
    with pytest.raises(ValueError, match="^time_limit must be positive and finite$"):
        search.iterative_deepening_timed(chess.Board(fen), 3, time_limit)


@pytest.mark.parametrize("fen", ACTIVE_POSITIONS)
def test_timed_iterative_deepening_completes_max_depth(frozen_clock, fen):
    board = chess.Board(fen)
    original = board.copy(stack=True)
    move, score, depth = search.iterative_deepening_timed(board, 2, 1.0)
    assert (move, score) == search.negamax_best_move(board, 2)
    assert depth == 2
    assert_board_restored(board, original)


@pytest.mark.parametrize("mirrored", [False, True], ids=["original", "color-swapped"])
@pytest.mark.parametrize("fen,score", [(CHECKMATED, -MATE_SCORE), (STALEMATE, 0)])
def test_timed_iterative_deepening_terminal_board_skips_search(
    monkeypatch, mirrored, fen, score
):
    board = chess.Board(fen)
    if mirrored:
        board = board.mirror()

    def unexpected_call(*args):
        pytest.fail("terminal positions should return without starting timed search")

    monkeypatch.setattr(search, "negamax_best_move_timed", unexpected_call)
    monkeypatch.setattr(search.time, "perf_counter", unexpected_call)
    assert search.iterative_deepening_timed(board, 3, 1.0) == (None, score, 0)


@pytest.mark.parametrize("fen", [WHITE_WINNING, BLACK_WINNING])
def test_timed_iterative_deepening_immediate_timeout_returns_legal_fallback(
    monkeypatch, fen
):
    board = chess.Board(fen)
    original = board.copy(stack=True)
    color = 1 if board.turn == chess.WHITE else -1
    clock = iter([100.0, 101.0])
    monkeypatch.setattr(search.time, "perf_counter", lambda: next(clock))

    move, score, depth = search.iterative_deepening_timed(board, 3, 1.0)

    assert move in board.legal_moves
    assert score == color * evaluate(board)
    assert depth == 0
    assert_board_restored(board, original)


@pytest.mark.parametrize("completed_depth", [1, 2, 3])
def test_timed_iterative_deepening_keeps_last_completed_result(
    frozen_clock, monkeypatch, completed_depth
):
    board = chess.Board()
    results = [
        (chess.Move.from_uci("e2e4"), 100),
        (chess.Move.from_uci("d2d4"), -50),
        (chess.Move.from_uci("g1f3"), 25),
    ]
    calls = []

    def timed_best_move(current_board, depth, deadline):
        assert current_board is board
        # Every iteration must share the original time budget.
        assert deadline == 101.0
        calls.append(depth)
        if depth > completed_depth:
            raise search.SearchTimeout
        return results[depth - 1]

    monkeypatch.setattr(search, "negamax_best_move_timed", timed_best_move)
    assert search.iterative_deepening_timed(board, 5, 1.0) == (
        *results[completed_depth - 1],
        completed_depth,
    )
    assert calls == list(range(1, completed_depth + 2))


def test_timed_iterative_deepening_restores_history_after_partial_iteration(
    monkeypatch,
):
    board = chess.Board()
    for uci in ["e2e4", "d7d5", "e4d5"]:
        board.push_uci(uci)
    original = board.copy(stack=True)
    expected = search.negamax_best_move(board, 1)
    real_best_move = search.negamax_best_move_timed
    current_depth = 0
    checks = 0

    def clock():
        nonlocal checks
        if current_depth == 2:
            checks += 1
            # Expire inside a child, after the root has pushed a move.
            if checks >= 3:
                return 101.0
        return 100.0

    def timed_best_move(current_board, depth, deadline):
        nonlocal current_depth
        current_depth = depth
        return real_best_move(current_board, depth, deadline)

    monkeypatch.setattr(search.time, "perf_counter", clock)
    monkeypatch.setattr(search, "negamax_best_move_timed", timed_best_move)

    assert search.iterative_deepening_timed(board, 3, 1.0) == (*expected, 1)
    assert checks == 3
    assert_board_restored(board, original)


def test_timed_iterative_deepening_propagates_unexpected_errors(
    frozen_clock, monkeypatch
):
    def broken_search(*args):
        raise RuntimeError("search failed")

    monkeypatch.setattr(search, "negamax_best_move_timed", broken_search)
    with pytest.raises(RuntimeError, match="search failed"):
        search.iterative_deepening_timed(chess.Board(), 3, 1.0)
