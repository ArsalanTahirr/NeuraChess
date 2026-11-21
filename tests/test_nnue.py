import chess
import numpy as np
import pytest
import torch

from neurachess.neural.encoding import encode_board
from neurachess.neural.evaluator import NeuralEvaluator
from neurachess.neural.nnue import ARCHITECTURE, KingBucketNNUE
from neurachess.neural.nnue_inference import NNUEAccumulator, NNUEWeights
from scripts.train_nnue import encode_rows


@pytest.fixture(scope="module")
def model():
    with torch.random.fork_rng():
        torch.manual_seed(7)
        model = KingBucketNNUE().eval()
        # Distinct buckets and nonzero biases detect stale accumulators on king moves.
        with torch.no_grad():
            model.buckets.normal_(std=0.02)
        return model


@pytest.mark.parametrize(
    ("fen", "line"),
    [
        (chess.STARTING_FEN, "e4 a6 e5 d5 exd6"),
        ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "O-O O-O-O"),
        ("4k3/P7/8/8/8/8/1p6/4K3 w - - 0 1", "a8=Q+ Kf7 Qd5+ Kg7"),
        ("2r3k1/1P6/8/8/8/8/8/4K3 w - - 0 1", "bxc8=N"),
        ("5r2/ppp1p2k/3pb3/3p4/8/4K3/8/8 w - - 2 48", "Kd4 Rf4+ Kc3"),
    ],
)
def test_training_and_incremental_scores_agree_through_moves_and_undo(model, fen, line):
    weights = NNUEWeights(model)
    search = NNUEAccumulator(weights)
    board = chess.Board(fen)

    def check():
        ids, material = encode_rows(encode_board(board).numpy()[None, :])
        with torch.no_grad():
            pawns = model(
                torch.from_numpy(ids).int(), torch.from_numpy(material)
            ).item()
        cp = pawns * (100 if board.turn else -100)
        score = search(board)
        assert score == NNUEAccumulator(weights)(board)
        assert score == pytest.approx(cp, abs=0.1)

    check()
    for san in line.split():
        board.push_san(san)
        check()
    while board.move_stack:
        board.pop()
        check()


def test_nnue_checkpoint_scores_and_searches_are_independent(tmp_path, model):
    checkpoint = tmp_path / "nnue.pt"
    torch.save(
        {"architecture": ARCHITECTURE, "model_state_dict": model.state_dict()},
        checkpoint,
    )
    evaluator = NeuralEvaluator(checkpoint, require_architecture=True)
    first, second = evaluator.for_search(), evaluator.for_search()
    assert first is not second
    board = chess.Board()
    before = first(board)
    board.push_san("e4")
    assert np.isfinite(second(board))
    board.pop()
    assert first(board) == before
    assert evaluator.evaluate(board) == before
    assert evaluator.evaluate(chess.Board("8/8/8/8/8/4k3/8/4K3 w - - 0 1")) == 0
