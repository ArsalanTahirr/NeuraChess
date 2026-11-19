from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset


class ChessDataset(Dataset):
    def __init__(self, directory: str):
        directory = Path(directory)

        self.fen_encoded = np.load(directory / "X.npy", mmap_mode="r")
        self.cp_pawn_units = np.load(directory / "y.npy", mmap_mode="r")

    def __len__(self) -> int:
        # Return the number of examples
        return len(self.fen_encoded)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        # Return (x, y)
        x = torch.tensor(self.fen_encoded[index], dtype=torch.float32)
        y = torch.tensor(self.cp_pawn_units[index], dtype=torch.float32)
        return x, y
