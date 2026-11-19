import math

import chess
import numpy as np
import pyarrow as pa
import pytest
import torch
from torch.utils.data import random_split

from benchmarks.evaluator_benchmark import (
    benchmark_accuracy,
    benchmark_speed,
    load_neural,
    select_positions,
    validation_indices,
)
from neurachess.evaluation import evaluate_material
from neurachess.neural.model import ChessEvaluator


def test_accuracy_and_speed_evaluate_identical_boards():
    boards = [chess.Board(), chess.Board()]
    boards[1].push_san("e4")
    calls = {"material": [], "neural": []}

    def material(board):
        calls["material"].append(board)
        return 0

    def neural(board):
        calls["neural"].append(board)
        return 100 if board.turn == chess.WHITE else -100

    evaluators = {"material": material, "neural": neural}
    accuracy = benchmark_accuracy(list(zip(boards, [100, -300])), evaluators)
    assert calls["material"] == calls["neural"]
    assert all(actual is expected for actual, expected in zip(calls["neural"], boards))
    assert accuracy["evaluators"]["material"] == pytest.approx(
        {"mae_cp": 200, "rmse_cp": math.sqrt(50000), "bias_cp": 100}
    )
    assert accuracy["evaluators"]["neural"] == pytest.approx(
        {"mae_cp": 100, "rmse_cp": math.sqrt(20000), "bias_cp": 100}
    )
    assert accuracy["neural_better_pct"] == 100
    buckets = {bucket["name"]: bucket for bucket in accuracy["buckets"]}
    assert buckets["Equal"]["evaluators"]["neural"]["bucket_accuracy_pct"] == 100
    assert buckets["Moderate Black"]["evaluators"]["neural"]["bucket_accuracy_pct"] == 0
    assert buckets["Strong Black"]["positions"] == 0

    for seen in calls.values():
        seen.clear()
    speed = benchmark_speed(boards, evaluators, repeats=3)
    for name, seen in calls.items():
        assert all(
            actual is expected
            for actual, expected in zip(seen, boards * 4, strict=True)
        )
        assert len(speed["evaluators"][name]["repeat_seconds"]) == 3


def test_actual_evaluators_return_white_relative_centipawns(tmp_path):
    model = ChessEvaluator(hidden_sizes=(1,))
    with torch.no_grad():
        for parameter in model.parameters():
            parameter.zero_()
        model.network[-1].bias.fill_(1.5)

    checkpoint = tmp_path / "constant.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "input_size": 773,
            "hidden_sizes": (1,),
            "activation": "ReLU",
            "dropout": 0.0,
            "use_layer_norm": False,
        },
        checkpoint,
    )
    neural, _ = load_neural(checkpoint)
    assert not neural.model.training
    positions = [
        (chess.Board(f"4k3/8/8/8/8/8/P7/4K3 {turn} - - 0 1"), 125)
        for turn in ("w", "b")
    ]
    accuracy = benchmark_accuracy(
        positions, {"material": evaluate_material, "neural": neural.evaluate}
    )
    assert accuracy["evaluators"]["material"] == {
        "mae_cp": 25,
        "rmse_cp": 25,
        "bias_cp": -25,
    }
    assert accuracy["evaluators"]["neural"] == {
        "mae_cp": 25,
        "rmse_cp": 25,
        "bias_cp": 25,
    }
    assert accuracy["neural_better_pct"] == 0  # Ties do not count as wins.


def test_sampling_recreates_training_validation_and_is_reproducible():
    row_count = 103  # Exercise fractional split rounding.
    _, expected, test = random_split(
        range(row_count),
        [0.8, 0.1, 0.1],
        generator=torch.Generator().manual_seed(42),
    )
    indices = validation_indices(row_count)
    assert indices == expected.indices
    assert set(indices).isdisjoint(test.indices)
    fens = pa.array([chess.STARTING_FEN] * row_count)
    labels = np.arange(row_count)
    first, _ = select_positions(fens, labels, indices, samples=5, seed=73)
    second, _ = select_positions(fens, labels, indices, samples=5, seed=73)
    different, _ = select_positions(fens, labels, indices, samples=5, seed=74)
    assert first == second
    assert first != different
    assert len({label for _, label in first}) == 5
    assert all(label in indices for _, label in first)


def test_sampling_skips_terminal_positions():
    fens = pa.array(["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", chess.STARTING_FEN])
    positions, skipped = select_positions(fens, np.array([900, 20]), [0, 1], 1, seed=1)
    assert positions == [(chess.Board(), 20)]
    assert skipped == 1
