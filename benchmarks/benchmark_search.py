import statistics
import time

import chess

if __package__:
    from .search import SearchStats, alpha_beta, alpha_beta_ordered, minimax
else:
    from search import SearchStats, alpha_beta, alpha_beta_ordered, minimax

POSITIONS = {
    "Starting Position": chess.STARTING_FEN,
    "White Winning": "4k3/8/8/8/8/8/8/3QK3 w - - 0 1",
    "Black Winning": "r3k3/8/8/8/8/8/8/4K3 b - - 0 1",
    "Tactical Middlegame": (
        "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"
    ),
}

DEPTHS = [1, 2, 3]
REPEATS = 3
INF = float("inf")
ALGORITHMS = {
    "Minimax": minimax,
    "Alpha-Beta": alpha_beta,
    "Ordered Alpha-Beta": alpha_beta_ordered,
}


def benchmark(algorithm, board, depth):
    search = ALGORITHMS[algorithm]
    times = []
    result = None
    stats = None

    for _ in range(REPEATS):
        current_stats = SearchStats()
        current_board = board.copy(stack=True)

        start = time.perf_counter()

        if algorithm == "Minimax":
            score = search(current_board, depth, current_stats)
        else:
            score = search(current_board, depth, -INF, INF, current_stats)

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
            results = {name: benchmark(name, board, depth) for name in ALGORITHMS}
            minimax_score, mm_stats, mm_time = results["Minimax"]

            for name, (score, _, _) in results.items():
                assert score == minimax_score, (
                    f"{name} mismatch in {position_name} at depth {depth}: "
                    f"{score} != {minimax_score}"
                )

            print(f"\nDepth: {depth} plies")
            print(f"Evaluation: {minimax_score:+d}")
            print(f"{'Metric':<24}" + "".join(f"{name:>20}" for name in results))
            print("-" * 84)
            for label, attribute in [
                ("Nodes visited", "nodes"),
                ("Leaf evaluations", "evaluations"),
                ("Cutoffs", "cutoffs"),
            ]:
                print(
                    f"{label:<24}"
                    + "".join(
                        f"{getattr(stats, attribute):>20,}"
                        for _, stats, _ in results.values()
                    )
                )
            print(
                f"{'Median time (ms)':<24}"
                + "".join(
                    f"{elapsed * 1000:>20.2f}" for _, _, elapsed in results.values()
                )
            )
            print("Node reduction and runtime speedup relative to Minimax:")
            for name, (_, stats, elapsed) in results.items():
                if name == "Minimax":
                    continue
                reduction = 100 * (1 - stats.nodes / mm_stats.nodes)
                speedup = mm_time / elapsed if elapsed > 0 else INF
                print(f"  {name}: {reduction:.2f}% fewer nodes, {speedup:.2f}x speedup")


if __name__ == "__main__":
    main()
