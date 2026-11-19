import chess
import pytest
import torch

from neurachess.neural.evaluator import NeuralEvaluator
from neurachess.neural.model import ChessEvaluator


@pytest.mark.parametrize("legacy", [False, True], ids=["current", "legacy"])
def test_checkpoint_loads_in_eval_mode(tmp_path, legacy):
    dropout = 0.1 if legacy else 0.0
    model = ChessEvaluator(dropout=dropout)
    with torch.no_grad():
        for parameter in model.parameters():
            parameter.zero_()
        model.network[-1].bias.fill_(1.5)

    checkpoint = {
        "input_size": 773,
        "hidden_sizes": (256, 128),
        "model_state_dict": model.state_dict(),
    }
    if legacy:
        checkpoint["val_mse"] = 1.0
    else:
        checkpoint.update(activation="ReLU", dropout=dropout, use_layer_norm=False)
    path = tmp_path / "model.pt"
    torch.save(checkpoint, path)

    evaluator = NeuralEvaluator(path, require_architecture=True)
    assert not evaluator.model.training
    assert evaluator.checkpoint_configuration["dropout"] == dropout
    assert evaluator.evaluate(chess.Board()) == 150
