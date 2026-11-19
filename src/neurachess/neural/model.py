import torch
from torch import nn


class ChessEvaluator(nn.Module):
    def __init__(
        self,
        input_size: int = 773,
        hidden_sizes: tuple[int, ...] = (256, 128),
        activation: type[nn.Module] = nn.ReLU,
        dropout: float = 0.0,
    ):
        super().__init__()

        layers = []
        previous_size = input_size

        for hidden_size in hidden_sizes:
            layers.append(nn.Linear(previous_size, hidden_size))
            layers.append(activation())

            if dropout > 0.0:
                layers.append(nn.Dropout(dropout))

            previous_size = hidden_size

        layers.append(nn.Linear(previous_size, 1))

        self.network = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)
