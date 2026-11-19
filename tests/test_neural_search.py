import chess
import torch

from neurachess.neural.evaluator import NeuralEvaluator
from neurachess.neural.model import ChessEvaluator
from neurachess.search import iterative_deepening_timed


def test_timed_search_accepts_neural_evaluator(tmp_path, monkeypatch):
    model = ChessEvaluator(hidden_sizes=(1,))
    with torch.no_grad():
        for parameter in model.parameters():
            parameter.zero_()
        model.network[-1].bias.fill_(1.5)
    checkpoint = tmp_path / "model.pt"
    torch.save(
        {
            "input_size": 773,
            "hidden_sizes": (1,),
            "model_state_dict": model.state_dict(),
        },
        checkpoint,
    )
    neural = NeuralEvaluator(checkpoint)
    monkeypatch.setattr("neurachess.search.time.perf_counter", lambda: 0.0)
    board = chess.Board()
    move, score, depth = iterative_deepening_timed(
        board, max_depth=1, time_limit=1, evaluator=neural.evaluate
    )

    assert move in board.legal_moves
    assert score == 150
    assert depth == 1
    assert board.fen() == chess.STARTING_FEN
