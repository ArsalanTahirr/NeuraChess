"""Play paired games with the same CPU search limits as the API."""

import argparse
from pathlib import Path
from statistics import mean

import chess
import torch

from neurachess.neural.evaluator import NeuralEvaluator
from neurachess.rules import game_outcome
from neurachess.search import iterative_deepening_timed

OPENINGS = {
    "Italian": "e4 e5 Nf3 Nc6 Bc4 Bc5",
    "Queen's Gambit": "d4 d5 c4 e6 Nc3 Nf6",
}


def play(opening, players, depth, seconds):
    board = chess.Board()
    for san in opening.split():
        board.push_san(san)
    depths = {chess.WHITE: [], chess.BLACK: []}
    while (outcome := game_outcome(board)) is None:
        move, _, completed = iterative_deepening_timed(
            board, depth, seconds, players[board.turn].for_search()
        )
        depths[board.turn].append(completed)
        board.push(move)
    return outcome, depths


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--candidate", type=Path, default=Path("checkpoints/nnue_v001.pt")
    )
    parser.add_argument(
        "--baseline", type=Path, default=Path("checkpoints/model_v001.pt")
    )
    parser.add_argument("--seconds", type=float, default=1.2)
    parser.add_argument("--depth", type=int, default=4)
    parser.add_argument("--opening", choices=OPENINGS)
    args = parser.parse_args()
    torch.set_num_threads(1)
    models = [
        NeuralEvaluator(p, require_architecture=True)
        for p in (args.candidate, args.baseline)
    ]
    for name, line in OPENINGS.items():
        if args.opening and name != args.opening:
            continue
        for color in (chess.WHITE, chess.BLACK):
            result, depths = play(
                line, {color: models[0], not color: models[1]}, args.depth, args.seconds
            )
            print(
                f"{name}, candidate as {chess.COLOR_NAMES[color]}: {result.result()} "
                f"({result.termination.name}, {sum(map(len, depths.values()))} searched plies), "
                f"mean depth candidate {mean(depths[color]):.2f}, baseline {mean(depths[not color]):.2f}",
                flush=True,
            )


if __name__ == "__main__":
    main()
