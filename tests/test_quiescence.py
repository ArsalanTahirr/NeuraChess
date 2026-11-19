import chess
import pytest

from neurachess import quiescence as quiescence_module
from neurachess import search_utils
from neurachess.evaluation import MATE_SCORE, classical_evaluate
from neurachess.quiescence import quiescence
from neurachess.search_utils import SearchTimeout

INF = float("inf")
CAPTURE = "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1"
RECAPTURE = "r3k3/8/8/8/8/8/q7/R3K3 w - - 0 1"
EN_PASSANT = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"
PROMOTION = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"
CAPTURE_PROMOTION = "1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1"
CAPTURE_MATE = "7k/5Kp1/6Q1/8/8/8/8/8 w - - 0 1"
IN_CHECK = "4r1k1/8/8/8/8/8/8/4K3 w - - 0 1"

TACTICAL_POSITIONS = [
    pytest.param(CAPTURE, 500, id="hanging-queen"),
    pytest.param(RECAPTURE, -500, id="defended-queen-recapture"),
    pytest.param("r3k3/8/8/8/8/8/p7/Q3K3 w - - 0 1", 300, id="decline-losing-capture"),
    pytest.param(EN_PASSANT, 100, id="en-passant"),
    pytest.param(PROMOTION, 900, id="quiet-promotion"),
    pytest.param(CAPTURE_PROMOTION, 900, id="capture-promotion"),
    pytest.param(CAPTURE_MATE, MATE_SCORE - 1, id="capture-delivers-mate"),
]


def assert_board_restored(board, original):
    assert board.fen(en_passant="fen") == original.fen(en_passant="fen")
    assert board.move_stack == original.move_stack
    restored = board.copy(stack=True)
    expected = original.copy(stack=True)
    while restored.move_stack:
        restored.pop()
        expected.pop()
        assert restored.fen(en_passant="fen") == expected.fen(en_passant="fen")


@pytest.mark.parametrize("fen,expected", TACTICAL_POSITIONS)
@pytest.mark.parametrize("mirrored", [False, True], ids=["white", "black"])
def test_tactical_sequences_return_side_to_move_score(fen, expected, mirrored):
    board = chess.Board(fen)
    if mirrored:
        board = board.mirror()
    assert board.is_valid()
    original = board.copy(stack=True)

    assert quiescence(board, -INF, INF) == expected
    assert_board_restored(board, original)


@pytest.mark.parametrize(
    "fen,expected",
    [
        pytest.param(chess.STARTING_FEN, 0, id="starting-position"),
        pytest.param("4k3/8/8/8/8/8/8/3QK3 w - - 0 1", 900, id="white-up-queen"),
        pytest.param("r3k3/8/8/8/8/8/8/4K3 b - - 0 1", 500, id="black-up-rook"),
        pytest.param(
            "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", 200, id="quiet-mate-not-searched"
        ),
    ],
)
def test_quiet_position_returns_stand_pat_without_searching_moves(fen, expected):
    board = chess.Board(fen)
    evaluations = []

    def tracked_evaluate(current_board):
        evaluations.append(current_board.fen())
        return classical_evaluate(current_board)

    assert quiescence(board, -INF, INF, evaluator=tracked_evaluate) == expected
    assert evaluations == [board.fen()]


@pytest.mark.parametrize("beta", [-401, -400])
def test_stand_pat_at_or_above_beta_skips_available_capture(monkeypatch, beta):
    board = chess.Board(CAPTURE)

    def unexpected_move_scoring(*args):
        pytest.fail("stand-pat cutoff should return before searching captures")

    monkeypatch.setattr(quiescence_module, "score_move", unexpected_move_scoring)
    assert quiescence(board, -INF, beta) == -400


def test_quiet_fail_low_returns_evaluation_instead_of_alpha():
    assert quiescence(chess.Board(), 100, 200) == 0


@pytest.mark.parametrize("fen,score", TACTICAL_POSITIONS)
def test_narrow_window_results_bound_full_window_score(fen, score):
    board = chess.Board(fen)
    fail_high = quiescence(board, score - 200, score - 100)
    fail_low = quiescence(board, score + 100, score + 200)
    assert score - 100 <= fail_high <= score
    assert score <= fail_low <= score + 100
    assert quiescence(board, score - 1, score + 1) == score


@pytest.mark.parametrize("beta", [INF, -600])
def test_in_check_searches_quiet_evasions_instead_of_standing_pat(beta):
    board = chess.Board(IN_CHECK)
    assert board.is_check()
    legal_moves = set(board.legal_moves)
    assert legal_moves
    assert all(not board.is_capture(move) for move in legal_moves)
    evaluated_evasions = []

    def tracked_evaluate(current_board):
        assert not current_board.is_check()
        assert current_board.move_stack
        evaluated_evasions.append(current_board.move_stack[0])
        return classical_evaluate(current_board)

    assert quiescence(board, -INF, beta, evaluator=tracked_evaluate) == -500
    assert evaluated_evasions
    if beta == INF:
        assert set(evaluated_evasions) == legal_moves
    else:
        assert len(evaluated_evasions) == 1


@pytest.mark.parametrize("mirrored", [False, True], ids=["original", "color-swapped"])
@pytest.mark.parametrize(
    "fen,expected",
    [
        pytest.param("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1", -MATE_SCORE, id="checkmate"),
        pytest.param("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", 0, id="stalemate"),
        pytest.param("4k3/8/8/8/8/8/8/4K3 w - - 0 1", 0, id="insufficient-material"),
    ],
)
def test_terminal_positions_return_exact_score(fen, expected, mirrored):
    board = chess.Board(fen)
    if mirrored:
        board = board.mirror()
    assert board.is_valid()
    assert board.is_game_over()
    # Terminal scores take precedence over the supplied search window.
    assert quiescence(board, 100, 200) == expected


@pytest.mark.parametrize("deadline", [100.0, 99.0])
@pytest.mark.parametrize("fen", [CAPTURE, "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"])
def test_expired_deadline_raises_before_search_or_terminal_evaluation(
    monkeypatch, deadline, fen
):
    monkeypatch.setattr(search_utils.time, "perf_counter", lambda: 100.0)
    board = chess.Board(fen)
    with pytest.raises(SearchTimeout):
        quiescence(board, -INF, INF, deadline)


def test_optional_deadline_skips_timeout_checks(monkeypatch):
    def unexpected_check(*args):
        pytest.fail("deadline=None should disable timeout checks")

    monkeypatch.setattr(quiescence_module, "check_timeout", unexpected_check)
    assert quiescence(chess.Board(CAPTURE), -INF, INF) == 500


@pytest.mark.parametrize("fen,expected", TACTICAL_POSITIONS)
def test_search_with_time_remaining_matches_untimed_score(monkeypatch, fen, expected):
    monkeypatch.setattr(search_utils.time, "perf_counter", lambda: 100.0)
    assert quiescence(chess.Board(fen), -INF, INF, 101.0) == expected


@pytest.mark.parametrize("expire_on_check", [1, 2, 3, 4, 5])
def test_timeout_restores_board_during_nested_search(monkeypatch, expire_on_check):
    board = chess.Board(CAPTURE_PROMOTION)
    original = board.copy(stack=True)
    checks = 0

    def clock():
        nonlocal checks
        checks += 1
        return 101.0 if checks >= expire_on_check else 100.0

    monkeypatch.setattr(search_utils.time, "perf_counter", clock)
    with pytest.raises(SearchTimeout):
        quiescence(board, -INF, INF, 101.0)
    assert checks == expire_on_check
    assert_board_restored(board, original)


@pytest.mark.parametrize("interrupted", [False, True], ids=["success", "timeout"])
def test_search_preserves_existing_move_history(monkeypatch, interrupted):
    board = chess.Board()
    for uci in ["e2e4", "d7d5"]:
        board.push_uci(uci)
    original = board.copy(stack=True)

    if interrupted:
        # Root check, before the capture, then inside the child after pushing it.
        clock = iter([100.0, 100.0, 101.0])
        monkeypatch.setattr(search_utils.time, "perf_counter", lambda: next(clock))
        with pytest.raises(SearchTimeout):
            quiescence(board, -INF, INF, 101.0)
    else:
        quiescence(board, -INF, INF)

    assert_board_restored(board, original)


def test_evaluation_error_in_child_restores_board_and_propagates():
    board = chess.Board(CAPTURE)
    original = board.copy(stack=True)

    def broken_child_evaluation(current_board):
        if current_board.move_stack:
            raise RuntimeError("evaluation failed")
        return classical_evaluate(current_board)

    with pytest.raises(RuntimeError, match="evaluation failed"):
        quiescence(board, -INF, INF, evaluator=broken_child_evaluation)
    assert_board_restored(board, original)
