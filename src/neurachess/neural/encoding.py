import chess
import torch

PIECE_TO_PLANE = {
    (chess.WHITE, chess.PAWN): 0,
    (chess.WHITE, chess.KNIGHT): 1,
    (chess.WHITE, chess.BISHOP): 2,
    (chess.WHITE, chess.ROOK): 3,
    (chess.WHITE, chess.QUEEN): 4,
    (chess.WHITE, chess.KING): 5,
    (chess.BLACK, chess.PAWN): 6,
    (chess.BLACK, chess.KNIGHT): 7,
    (chess.BLACK, chess.BISHOP): 8,
    (chess.BLACK, chess.ROOK): 9,
    (chess.BLACK, chess.QUEEN): 10,
    (chess.BLACK, chess.KING): 11,
}


def encode_board(board: chess.Board) -> torch.Tensor:
    features = [0.0] * (12 * 64)

    for square, piece in board.piece_map().items():
        plane_index = PIECE_TO_PLANE[(piece.color, piece.piece_type)]
        # Each plane starts at rank 8, while python-chess numbers from rank 1.
        features[plane_index * 64 + chess.square_mirror(square)] = 1.0

    features.extend(
        (
            board.turn == chess.WHITE,
            board.has_kingside_castling_rights(chess.WHITE),
            board.has_queenside_castling_rights(chess.WHITE),
            board.has_kingside_castling_rights(chess.BLACK),
            board.has_queenside_castling_rights(chess.BLACK),
        )
    )
    return torch.tensor(features, dtype=torch.float32)
