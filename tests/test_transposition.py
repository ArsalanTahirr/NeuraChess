import chess
import chess.polyglot
import pytest

from neurachess import search
from neurachess.evaluation import MATE_SCORE
from neurachess.transposition import TTEntry, TTFlag, position_key

INF = float("inf")
CAPTURE = "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1"


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch):
    monkeypatch.setattr(search.time, "perf_counter", lambda: 100.0)


def test_position_key_is_hashable_and_preserves_board():
    board = chess.Board()
    board.push_uci("g1f3")
    original = board.copy(stack=True)
    key = position_key(board)
    assert key == (chess.polyglot.zobrist_hash(board), 1, (board.peek(),))
    assert {key: "cached"}[position_key(board.copy(stack=True))] == "cached"
    assert board == original
    assert board.move_stack == original.move_stack


@pytest.mark.parametrize(
    "fen",
    [
        chess.STARTING_FEN.replace(" w ", " b "),
        chess.STARTING_FEN.replace("KQkq", "KQ"),
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 1 1",
    ],
)
def test_position_key_distinguishes_turn_castling_and_halfmove_clock(fen):
    assert position_key(chess.Board(fen)) != position_key(chess.Board())


def test_position_key_distinguishes_legal_en_passant():
    board = chess.Board("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1")
    without_ep = board.copy()
    without_ep.ep_square = None
    assert position_key(board) != position_key(without_ep)


def test_position_key_distinguishes_repetition_history_for_same_position():
    boards = []
    for moves in [
        ["g1f3", "g8f6", "f3g1", "f6g8"],
        ["b1c3", "b8c6", "c3b1", "c6b8"],
    ]:
        board = chess.Board()
        for move in moves:
            board.push_uci(move)
        boards.append(board)
    assert boards[0].fen() == boards[1].fen()
    assert position_key(boards[0]) != position_key(boards[1])
    assert position_key(boards[0]) != position_key(chess.Board(boards[0].fen()))


@pytest.mark.parametrize(
    "moves",
    [
        ["g1f3", "g8f6", "e2e4"],
        ["e2e4", "d7d5", "e4d5"],
    ],
)
def test_position_key_discards_history_before_pawn_move_or_capture(moves):
    board = chess.Board()
    for move in moves:
        board.push_uci(move)
    assert position_key(board) == position_key(chess.Board(board.fen()))
    board.push(next(iter(board.legal_moves)))
    assert position_key(board)[2] == tuple(board.move_stack[-board.halfmove_clock :])


@pytest.mark.parametrize("entry_depth", [2, 3])
def test_sufficiently_deep_exact_hit_skips_search(monkeypatch, entry_depth):
    board = chess.Board()
    entry = TTEntry(entry_depth, 123, TTFlag.EXACT, None)
    tt = {position_key(board): entry}

    def unexpected_search(*args):
        pytest.fail("an exact cache hit should skip move generation")

    monkeypatch.setattr(search, "order_moves", unexpected_search)
    assert search.negamax_ab_timed(board, 2, -INF, INF, 101.0, tt) == 123
    assert tt[position_key(board)] is entry


@pytest.mark.parametrize(
    "flag,score,alpha,beta",
    [
        (TTFlag.LOWERBOUND, 50, -100, 50),
        (TTFlag.UPPERBOUND, -50, -50, 100),
    ],
)
def test_cached_bound_can_cut_off_without_search(monkeypatch, flag, score, alpha, beta):
    board = chess.Board()
    tt = {position_key(board): TTEntry(2, score, flag, None)}

    def unexpected_search(*args):
        pytest.fail("a cached bound closing the window should skip search")

    monkeypatch.setattr(search, "order_moves", unexpected_search)
    assert search.negamax_ab_timed(board, 2, alpha, beta, 101.0, tt) == score


@pytest.mark.parametrize(
    "flag,score,expected_window",
    [
        (TTFlag.LOWERBOUND, 10, (-100, -10)),
        (TTFlag.UPPERBOUND, 50, (-50, 100)),
    ],
)
def test_cached_bound_tightens_window_when_search_continues(
    monkeypatch, flag, score, expected_window
):
    board = chess.Board()
    tt = {position_key(board): TTEntry(1, score, flag, None)}
    windows = []

    def leaf(current_board, alpha, beta, deadline):
        windows.append((alpha, beta))
        return 0

    monkeypatch.setattr(search, "quiescence", leaf)
    search.negamax_ab_timed(board, 1, -100, 100, 101.0, tt)
    assert windows[0] == expected_window


@pytest.mark.parametrize(
    "alpha,beta,flag",
    [
        (-INF, INF, TTFlag.EXACT),
        (-200, -100, TTFlag.LOWERBOUND),
        (0, 100, TTFlag.UPPERBOUND),
    ],
)
def test_completed_search_stores_score_depth_bound_and_best_move(alpha, beta, flag):
    board = chess.Board()
    tt = {}
    score = search.negamax_ab_timed(board, 1, alpha, beta, 101.0, tt)
    entry = tt[position_key(board)]
    assert score == 0
    assert entry.depth == 1
    assert entry.score == score
    assert entry.flag is flag
    assert entry.best_move in board.legal_moves


@pytest.mark.parametrize("cached_move", ["e2e4", "a1a8", None])
def test_shallow_entry_only_orders_legal_best_move_and_is_replaced(
    monkeypatch, cached_move
):
    board = chess.Board()
    move = chess.Move.from_uci(cached_move) if cached_move else None
    key = position_key(board)
    tt = {key: TTEntry(0, 99999, TTFlag.EXACT, move)}
    visited = []
    expected_first = move if move in board.legal_moves else search.order_moves(board)[0]

    def leaf(current_board, alpha, beta, deadline):
        visited.append(current_board.peek())
        return 0

    monkeypatch.setattr(search, "quiescence", leaf)
    assert search.negamax_ab_timed(board, 1, -INF, INF, 101.0, tt) == 0
    assert visited[0] == expected_first
    assert set(visited) == set(board.legal_moves)
    assert len(visited) == board.legal_moves.count()
    assert tt[key] == TTEntry(1, 0, TTFlag.EXACT, expected_first)


@pytest.mark.parametrize("flag", [TTFlag.LOWERBOUND, TTFlag.UPPERBOUND])
def test_shallower_search_preserves_deeper_non_cutting_entry(flag):
    board = chess.Board()
    entry = TTEntry(3, -100 if flag is TTFlag.LOWERBOUND else 100, flag, None)
    tt = {position_key(board): entry}
    assert search.negamax_ab_timed(board, 1, -INF, INF, 101.0, tt) == 0
    assert tt[position_key(board)] is entry


@pytest.mark.parametrize(
    "fen,depth,expected",
    [
        (CAPTURE, 0, 500),
        ("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1", 2, -MATE_SCORE),
    ],
)
def test_terminal_and_quiescence_scores_take_precedence_over_cache(
    fen, depth, expected
):
    board = chess.Board(fen)
    entry = TTEntry(10, 123456, TTFlag.EXACT, None)
    tt = {position_key(board): entry}
    assert search.negamax_ab_timed(board, depth, -INF, INF, 101.0, tt) == expected
    assert tt[position_key(board)] is entry


@pytest.mark.parametrize(
    "fen",
    [
        chess.STARTING_FEN,
        CAPTURE,
        "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
        "r3k3/8/8/8/8/8/8/4K3 b - - 0 1",
    ],
)
@pytest.mark.parametrize("depth", [1, 2, 3])
def test_cached_search_matches_uncached_search_and_restores_history(fen, depth):
    board = chess.Board(fen)
    original = board.copy(stack=True)
    expected = search.negamax_ab_timed(board, depth, -INF, INF, 101.0)
    tt = {}
    # Reuse results across increasing depths, as iterative deepening does.
    for current_depth in range(1, depth + 1):
        result = search.negamax_ab_timed(board, current_depth, -INF, INF, 101.0, tt)
    assert result == expected
    assert board == original
    assert board.move_stack == original.move_stack


def test_best_move_search_passes_table_to_children_and_reuses_entries(monkeypatch):
    board = chess.Board()
    tt = {}
    expected = search.negamax_best_move_timed(board, 2, 101.0)
    assert search.negamax_best_move_timed(board, 2, 101.0, tt) == expected
    assert tt

    def unexpected_leaf(*args):
        pytest.fail("repeated search should use cached child scores")

    monkeypatch.setattr(search, "quiescence", unexpected_leaf)
    assert search.negamax_best_move_timed(board, 2, 101.0, tt) == expected


def test_expired_deadline_takes_precedence_over_exact_hit():
    board = chess.Board()
    tt = {position_key(board): TTEntry(3, 123, TTFlag.EXACT, None)}
    with pytest.raises(search.SearchTimeout):
        search.negamax_ab_timed(board, 2, -INF, INF, 100.0, tt)


def test_timeout_in_child_restores_board_and_does_not_cache_incomplete_root(
    monkeypatch,
):
    board = chess.Board()
    board.push_uci("e2e4")
    original = board.copy(stack=True)
    key = position_key(board)
    entry = TTEntry(0, 100, TTFlag.EXACT, None)
    tt = {key: entry}
    clock = iter([100.0, 100.0, 101.0])
    monkeypatch.setattr(search.time, "perf_counter", lambda: next(clock))
    with pytest.raises(search.SearchTimeout):
        search.negamax_ab_timed(board, 2, -INF, INF, 101.0, tt)
    assert board == original
    assert board.move_stack == original.move_stack
    assert tt == {key: entry}


def test_iterative_deepening_reuses_one_table_per_search(monkeypatch):
    board = chess.Board()
    tables = []
    key = position_key(board)
    entry = TTEntry(1, 0, TTFlag.EXACT, None)

    def best_move(current_board, depth, deadline, tt):
        assert current_board is board
        assert deadline == 101.0
        if depth == 1:
            assert tt == {}
            tables.append(tt)
            tt[key] = entry
        else:
            assert tt is tables[-1]
            assert tt[key] is entry
        return chess.Move.from_uci("e2e4"), 0

    monkeypatch.setattr(search, "negamax_best_move_timed", best_move)
    for _ in range(2):
        assert search.iterative_deepening_timed(board, 3, 1.0) == (
            chess.Move.from_uci("e2e4"),
            0,
            3,
        )
    assert tables[0] is not tables[1]


@pytest.mark.parametrize("window", [(-600, -500), (600, 700)])
def test_bound_from_narrow_search_is_safe_to_reuse_in_full_search(window):
    board = chess.Board(CAPTURE)
    tt = {}
    expected = search.negamax_ab_timed(board, 2, -INF, INF, 101.0)
    search.negamax_ab_timed(board, 2, *window, 101.0, tt)
    assert tt[position_key(board)].flag is not TTFlag.EXACT
    assert search.negamax_ab_timed(board, 2, -INF, INF, 101.0, tt) == expected


def test_quiescence_leaf_is_not_stored_as_full_depth_search():
    board = chess.Board(CAPTURE)
    tt = {}
    assert search.negamax_ab_timed(board, 0, -INF, INF, 101.0, tt) == 500
    assert tt == {}
