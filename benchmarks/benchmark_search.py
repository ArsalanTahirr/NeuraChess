import statistics
import time

import chess
from search import SearchStats, alpha_beta, minimax

POSITIONS = {
    "Starting Position": chess.STARTING_FEN,
    "White Winning": "4k3/8/8/8/8/8/8/3QK3 w - - 0 1",
    "Black Winning": "r3k3/8/8/8/8/8/8/4K3 b - - 0 1",
}

DEPTHS = [1, 2, 3]
REPEATS = 3
INF = float("inf")


def benchmark(algorithm, board, depth):
    times = []
    result = None
    stats = None

    for _ in range(REPEATS):
        current_stats = SearchStats()
        current_board = board.copy(stack=True)

        start = time.perf_counter()

        if algorithm == "Minimax":
            score = minimax(current_board, depth, current_stats)
        else:
            score = alpha_beta(current_board, depth, -INF, INF, current_stats)

        elapsed = time.perf_counter() - start

        times.append(elapsed)
        result = score
        stats = current_stats

    return result, stats, statistics.median(times)


def main():
    for position_name, fen in POSITIONS.items():
        print(f"\n{'=' * 80}")
        print(f"Position: {position_name}")
        print(f"{'=' * 80}")

        board = chess.Board(fen)

        for depth in DEPTHS:
            minimax_score, mm_stats, mm_time = benchmark("Minimax", board, depth)

            ab_score, ab_stats, ab_time = benchmark("Alpha-Beta", board, depth)

            assert minimax_score == ab_score, f"Search mismatch at depth {depth}"

            reduction = 100 * (1 - ab_stats.nodes / mm_stats.nodes)

            speedup = mm_time / ab_time if ab_time > 0 else float("inf")

            print(f"\nDepth: {depth} plies")
            print(f"Evaluation: {minimax_score:+d}")
            print(f"{'Metric':<22} {'Minimax':>14} {'Alpha-Beta':>14}")
            print("-" * 52)
            print(f"{'Nodes visited':<22}{mm_stats.nodes:>14,}{ab_stats.nodes:>14,}")
            print(
                f"{'Leaf evaluations':<22}"
                f"{mm_stats.evaluations:>14,}"
                f"{ab_stats.evaluations:>14,}"
            )
            print(f"{'Cutoffs':<22}{mm_stats.cutoffs:>14,}{ab_stats.cutoffs:>14,}")
            print(
                f"{'Median time (ms)':<22}"
                f"{mm_time * 1000:>14.2f}"
                f"{ab_time * 1000:>14.2f}"
            )
            print(f"Node reduction: {reduction:.2f}%")
            print(f"Runtime speedup: {speedup:.2f}x")


if __name__ == "__main__":
    main()
