"""Incremental first-layer inference for the original dense evaluator."""

import chess
import numpy as np
import torch

from neurachess.neural.encoding import position_flags
from neurachess.neural.model import ChessEvaluator


def feature_bits(board: chess.Board) -> int:
    """Pack active features with python-chess square numbering in each plane."""
    white, black = board.occupied_co[chess.WHITE], board.occupied_co[chess.BLACK]
    bits = sum(
        int(flag) << (768 + index) for index, flag in enumerate(position_flags(board))
    )
    for index, mask in enumerate(
        (
            board.pawns,
            board.knights,
            board.bishops,
            board.rooks,
            board.queens,
            board.kings,
        )
    ):
        bits |= ((mask & white) | (mask & black) << 384) << (64 * index)
    return bits


class MLPWeights:
    def __init__(self, model: ChessEvaluator):
        first = model.network[0]
        # The checkpoint's piece planes start at rank 8. Reorder the columns
        # once so search can use python-chess's bitboards directly.
        columns = [
            index ^ 56 if index < 768 else index for index in range(first.in_features)
        ]
        self.columns = np.ascontiguousarray(
            first.weight.detach().numpy().T[columns], dtype=np.float64
        )
        self.bias = first.bias.detach().numpy().astype(np.float64)
        self.tail = model.network[1:]


class MLPAccumulator:
    def __init__(self, weights: MLPWeights):
        self.weights = weights
        self.bits = 0
        # Keep the running sum in FP64 to limit roundoff across search branches.
        self.total = weights.bias.copy()
        self.updates = 0

    @torch.inference_mode()
    def __call__(self, board: chess.Board) -> float:
        bits = feature_bits(board)
        changed = self.bits ^ bits
        if self.updates >= 256 or changed.bit_count() >= bits.bit_count():
            active = list(chess.scan_forward(bits))
            self.total[:] = self.weights.bias + self.weights.columns[active].sum(axis=0)
            self.updates = 0
        elif changed:
            for feature in chess.scan_forward(changed & self.bits):
                self.total -= self.weights.columns[feature]
            for feature in chess.scan_forward(changed & bits):
                self.total += self.weights.columns[feature]
            self.updates += 1
        self.bits = bits
        first_layer = torch.from_numpy(self.total.astype(np.float32))
        return self.weights.tail(first_layer).item() * 100
