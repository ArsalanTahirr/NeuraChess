"""King-bucketed NNUE. Feature indices use a1=0, friendly pieces first."""

import chess
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F

from neurachess.evaluation import PIECE_VALUES

ARCHITECTURE = "king_bucket_nnue_v1"
WIDTH = 256
HEAD_WIDTH = 32
# Twelve piece-square planes, then friendly K/Q and enemy K/Q castling rights.
FEATURES = 12 * 64 + 4
KING_BUCKETS = 6
PADDING = KING_BUCKETS * FEATURES
MATERIAL = np.array([PIECE_VALUES[p] / 100 for p in chess.PIECE_TYPES] * 2)
MATERIAL[6:] *= -1


def king_bucket(square):
    file = square % 8
    return 3 * (square >= 16) + (file >= 3) + (file >= 5)


# Convert a White-oriented feature index to the Black perspective.
BLACK_INDEX = np.array(
    [
        ((i // 64 + 6) % 12) * 64 + ((i % 64) ^ 56)
        if i < 768
        else 768 + (i - 768 + 2) % 4
        for i in range(FEATURES)
    ],
    dtype=np.int32,
)


class KingBucketNNUE(nn.Module):
    def __init__(self):
        super().__init__()
        self.shared = nn.Parameter(torch.empty(FEATURES, WIDTH))
        self.buckets = nn.Parameter(torch.zeros(KING_BUCKETS, FEATURES, WIDTH))
        self.bias = nn.Parameter(torch.full((WIDTH,), 0.2))
        self.hidden = nn.Linear(2 * WIDTH, HEAD_WIDTH)
        self.output = nn.Linear(HEAD_WIDTH, 1)
        nn.init.normal_(self.shared, std=0.04)

    def feature_weights(self):
        return self.buckets + self.shared

    def forward(self, indices, material):
        # Active indices are ordered by side to move, then opponent.
        weights = F.pad(self.feature_weights().flatten(0, 1), (0, 0, 0, 1))
        features = F.embedding_bag(
            indices.flatten(0, 1), weights, mode="sum", padding_idx=PADDING
        )
        pair = (features + self.bias).clamp(0, 1).reshape(-1, 2 * WIDTH)
        correction = self.output(self.hidden(pair).relu()).squeeze(1)
        return material + correction
