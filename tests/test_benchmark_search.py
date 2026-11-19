import chess
import pytest

from benchmarks import benchmark_search
from benchmarks.search import SearchStats, alpha_beta, alpha_beta_ordered, minimax

INF = float("inf")


@pytest.mark.parametrize(
    "fen",
    [
        *benchmark_search.POSITIONS.values(),
        "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",  # Stalemate.
        "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",  # Checkmate.
        "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",  # Promotion.
        "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",  # En passant.
    ],
)
@pytest.mark.parametrize("depth", [0, 1, 2])
def test_benchmark_searches_agree_and_preserve_board(fen, depth):
    board = chess.Board(fen)
    original = board.copy(stack=True)
    expected = minimax(board, depth)

    for search in (alpha_beta, alpha_beta_ordered):
        stats = SearchStats()
        assert search(board, depth, -INF, INF, stats) == expected
        assert 1 <= stats.evaluations <= stats.nodes
        if depth == 0 or original.is_game_over():
            assert stats == SearchStats(nodes=1, evaluations=1)
        assert board == original
        assert board.move_stack == original.move_stack


def test_benchmark_dispatches_to_ordered_search(monkeypatch):
    calls = []

    def ordered_search(board, depth, alpha, beta, stats):
        calls.append((depth, alpha, beta))
        stats.nodes += 1
        return 123

    monkeypatch.setitem(
        benchmark_search.ALGORITHMS, "Ordered Alpha-Beta", ordered_search
    )
    score, stats, elapsed = benchmark_search.benchmark(
        "Ordered Alpha-Beta", chess.Board(), 2
    )

    assert score == 123
    assert stats.nodes == 1
    assert calls == [(2, -INF, INF)] * benchmark_search.REPEATS
    assert elapsed >= 0
