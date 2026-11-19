import chess

from neurachess.evaluation import PIECE_VALUES


def score_move(board: chess.Board, move: chess.Move) -> int:
    score = 0

    attacker = board.piece_at(move.from_square)

    if board.is_capture(move):
        if board.is_en_passant(move):
            victim_type = chess.PAWN
        else:
            victim_type = board.piece_at(move.to_square).piece_type

        score += 10 * PIECE_VALUES.get(victim_type, 0) - PIECE_VALUES.get(
            attacker.piece_type, 0
        )

    if move.promotion:
        score += PIECE_VALUES.get(move.promotion, 0)

    return score


def order_moves(board: chess.Board) -> list[chess.Move]:
    return sorted(board.legal_moves, key=lambda m: score_move(board, m), reverse=True)


def order_material_root_moves(board: chess.Board) -> list[chess.Move]:
    # Search keeps the first move at an equal score. Preserve tactical ordering
    # and give quiet moves a preference for fresh positions and development.
    home_rank = 0 if board.turn == chess.WHITE else 7
    pawn_rank = 1 if board.turn == chess.WHITE else 6
    center_files = (3, 4)

    def priority(move: chess.Move) -> tuple[int, bool, int]:
        tactical = score_move(board, move)
        piece = board.piece_type_at(move.from_square)
        from_rank = chess.square_rank(move.from_square)
        development = 0
        if board.is_castling(move):
            development = 3
        elif (
            piece == chess.PAWN
            and from_rank == pawn_rank
            and chess.square_file(move.from_square) in center_files
        ):
            development = 2
        elif (
            piece in (chess.KNIGHT, chess.BISHOP)
            and from_rank == home_rank
            and chess.square_rank(move.to_square) != home_rank
        ):
            development = int(chess.square_file(move.to_square) not in (0, 7))

        board.push(move)
        try:
            fresh = not board.is_repetition(2)
        finally:
            board.pop()
        return tactical, fresh, development

    moves = list(board.legal_moves)
    moves.sort(key=priority, reverse=True)
    return moves
