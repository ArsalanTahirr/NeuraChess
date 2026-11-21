"""Single-position CPU inference with search-local incremental accumulators."""

import chess
import numpy as np

from neurachess.evaluation import PIECE_VALUES
from neurachess.neural.nnue import BLACK_INDEX, king_bucket

# Integer sums keep full refreshes and arbitrarily long incremental runs identical.
SCALE = 16384


def board_features(board):
    rights = (
        int(board.has_kingside_castling_rights(chess.WHITE))
        | int(board.has_queenside_castling_rights(chess.WHITE)) << 1
        | int(board.has_kingside_castling_rights(chess.BLACK)) << 2
        | int(board.has_queenside_castling_rights(chess.BLACK)) << 3
    )
    features = rights << 768
    material_cp = 0
    for piece, mask in enumerate(
        (
            board.pawns,
            board.knights,
            board.bishops,
            board.rooks,
            board.queens,
            board.kings,
        ),
        start=1,
    ):
        white = mask & board.occupied_co[chess.WHITE]
        black = mask & board.occupied_co[chess.BLACK]
        features |= (white | black << 384) << (64 * (piece - 1))
        material_cp += PIECE_VALUES[piece] * (white.bit_count() - black.bit_count())
    buckets = (
        king_bucket(board.king(chess.WHITE)),
        king_bucket(board.king(chess.BLACK) ^ 56),
    )
    return features, material_cp, buckets


def active_ids(bits):
    return list(chess.scan_forward(bits))


class NNUEWeights:
    def __init__(self, model):
        # Fold shared and king-bucket features once. Both tables use the same
        # White-oriented change mask so captures and castling need no special cases.
        table = np.rint(model.feature_weights().detach().numpy() * SCALE).astype(
            np.int32
        )
        self.tables = (table, np.ascontiguousarray(table[:, BLACK_INDEX]))
        self.bias = np.rint(model.bias.detach().numpy() * SCALE).astype(np.int32)
        self.hidden = model.hidden.weight.detach().numpy()
        self.hidden_bias = model.hidden.bias.detach().numpy()
        self.output = model.output.weight.detach().numpy()[0]
        self.output_bias = model.output.bias.item()

    def predict(self, sums, white_turn, material_cp):
        first, second = sums if white_turn else sums[::-1]
        pair = np.clip(np.concatenate((first, second)), 0, SCALE).astype(np.float32)
        pair *= 1 / SCALE
        # A short matrix-vector product. einsum avoids multithreaded BLAS startup
        # per position, which otherwise dominates this small output layer.
        hidden = np.einsum("ij,j->i", self.hidden, pair) + self.hidden_bias
        correction = self.output @ np.maximum(hidden, 0) + self.output_bias
        return material_cp + float(correction) * (100 if white_turn else -100)


class NNUEAccumulator:
    """Reuse the last evaluated position within one search, even across branches.

    Deltas come from the actual board, so undo, skipped nodes and transpositions
    need no move-stack hooks. A king crossing a bucket refreshes its perspective.
    """

    def __init__(self, weights):
        self.weights = weights
        self.bits = 0
        self.buckets = (None, None)
        self.sums = (weights.bias.copy(), weights.bias.copy())

    def __call__(self, board):
        bits, material_cp, buckets = board_features(board)
        removed = active_ids(self.bits & ~bits)
        added = active_ids(bits & ~self.bits)
        # After moving between distant branches a fresh sum can be cheaper.
        refresh = len(added) + len(removed) >= bits.bit_count()
        all_ids = active_ids(bits) if refresh or self.buckets != buckets else None
        for side, bucket in enumerate(buckets):
            table = self.weights.tables[side][bucket]
            total = self.sums[side]
            if refresh or bucket != self.buckets[side]:
                total[:] = self.weights.bias + table[all_ids].sum(
                    axis=0, dtype=np.int32
                )
            else:
                for feature in removed:
                    total -= table[feature]
                for feature in added:
                    total += table[feature]
        self.bits, self.buckets = bits, buckets
        return self.weights.predict(self.sums, board.turn, material_cp)
