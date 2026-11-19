import chess
import torch

from neurachess.evaluation import MATE_SCORE
from neurachess.neural.encoding import encode_board
from neurachess.neural.model import ChessEvaluator
from neurachess.rules import game_outcome


class NeuralEvaluator:
    def __init__(self, checkpoint_path, *, require_architecture=False):
        checkpoint = torch.load(
            checkpoint_path,
            weights_only=True,
            map_location="cpu",
        )

        required = {"input_size", "hidden_sizes", "model_state_dict"}
        missing = required - checkpoint.keys()
        if missing:
            raise ValueError(
                f"Checkpoint is missing required fields: {', '.join(sorted(missing))}."
            )

        architecture = {"activation", "dropout", "use_layer_norm"}
        self.architecture_source = "checkpoint"
        if (
            architecture.isdisjoint(checkpoint)
            and "val_mse" in checkpoint
            and tuple(checkpoint["hidden_sizes"]) == (256, 128)
            and set(checkpoint["model_state_dict"])
            == {
                f"network.{layer}.{parameter}"
                for layer in (0, 3, 6)
                for parameter in ("weight", "bias")
            }
        ):
            # The legacy save cell in notebook revision 3c57ac4 omitted these fields.
            checkpoint.update(activation="ReLU", dropout=0.1, use_layer_norm=False)
            self.architecture_source = "legacy training notebook (3c57ac4)"

        missing = architecture - checkpoint.keys()
        if require_architecture and missing:
            raise ValueError(
                f"Checkpoint lacks architecture metadata: {', '.join(sorted(missing))}."
            )

        activation_name = checkpoint.get("activation", "ReLU")
        activations = {"ReLU": torch.nn.ReLU, "GELU": torch.nn.GELU}
        if activation_name not in activations:
            raise ValueError(f"Unsupported checkpoint activation: {activation_name!r}.")
        if checkpoint["input_size"] != 773:
            raise ValueError(
                "Checkpoint input size must match the 773-feature board encoding."
            )

        self.checkpoint_configuration = {
            key: checkpoint[key]
            for key in (
                "input_size",
                "hidden_sizes",
                "activation",
                "dropout",
                "use_layer_norm",
                "epoch",
                "val_mae_cp",
                "val_mse",
                "val_loss",
            )
            if key in checkpoint
        }
        self.model = ChessEvaluator(
            input_size=checkpoint["input_size"],
            hidden_sizes=tuple(checkpoint["hidden_sizes"]),
            activation=activations[activation_name],
            dropout=checkpoint.get("dropout", 0.0),
            use_layer_norm=checkpoint.get("use_layer_norm", False),
        )

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()

    @torch.inference_mode()
    def evaluate(self, board):
        result = game_outcome(board)
        if result is not None:
            if result.winner is None:
                return 0

            return MATE_SCORE if result.winner == chess.WHITE else -MATE_SCORE

        x = encode_board(board)
        prediction = self.model(x)

        return prediction.item() * 100
