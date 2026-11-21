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

    board = chess.Board("4k3/8/8/8/8/8/8/R3K3 w - - 99 51")
    assert evaluator.evaluate(board) == 150
    board.push_uci("a1a2")
    assert evaluator.evaluate(board) == 0


@pytest.mark.parametrize(
    "layer_norm,activation", [(False, torch.nn.ReLU), (True, torch.nn.GELU)]
)
def test_search_evaluator_matches_original_after_moves_and_undo(
    tmp_path, layer_norm, activation
):
    model = ChessEvaluator(use_layer_norm=layer_norm, activation=activation)
    path = tmp_path / "mlp.pt"
    torch.save(
        {
            "input_size": 773,
            "hidden_sizes": (256, 128),
            "activation": activation.__name__,
            "dropout": 0.0,
            "use_layer_norm": layer_norm,
            "model_state_dict": model.state_dict(),
        },
        path,
    )
    evaluator = NeuralEvaluator(path, require_architecture=True)
    evaluate_search = evaluator.for_search()
    assert evaluate_search is not evaluator.for_search()

    for fen, line in [
        (chess.STARTING_FEN, "e4 a6 e5 d5 exd6"),
        ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "O-O O-O-O"),
        ("2r3k1/1P6/8/8/8/8/8/4K3 w - - 0 1", "bxc8=R+"),
    ]:
        board = chess.Board(fen)
        for san in line.split():
            assert evaluate_search(board) == pytest.approx(
                evaluator.evaluate(board), abs=0.001
            )
            board.push_san(san)
        while board.move_stack:
            assert evaluate_search(board) == pytest.approx(
                evaluator.evaluate(board), abs=0.001
            )
            board.pop()
        assert evaluate_search(board) == pytest.approx(
            evaluator.evaluate(board), abs=0.001
        )
