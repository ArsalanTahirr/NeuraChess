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
    planes = torch.zeros((12, 8, 8), dtype=torch.float32)

    for square, piece in board.piece_map().items():
        plane_index = PIECE_TO_PLANE[(piece.color, piece.piece_type)]

        row = 7 - chess.square_rank(square)
        col = chess.square_file(square)

        planes[plane_index, row, col] = 1.0

    flat = planes.flatten()
    # [white_to_move, white_K, white_Q, black_K, black_Q]
    features = torch.empty(5, dtype=torch.float32)
    features[0] = float(board.turn == chess.WHITE)
    features[1] = float(board.has_kingside_castling_rights(chess.WHITE))
    features[2] = float(board.has_queenside_castling_rights(chess.WHITE))
    features[3] = float(board.has_kingside_castling_rights(chess.BLACK))
    features[4] = float(board.has_queenside_castling_rights(chess.BLACK))

    result = torch.cat((flat, features))
    return result
