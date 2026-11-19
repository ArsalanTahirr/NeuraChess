import chess


def game_outcome(board: chess.Board) -> chess.Outcome | None:
    """Adjudicate draws when the current position reaches the claim threshold."""
    outcome = board.outcome()
    if outcome is not None:
        return outcome
    if board.is_fifty_moves():
        return chess.Outcome(chess.Termination.FIFTY_MOVES, None)
    if board.is_repetition(3):
        return chess.Outcome(chess.Termination.THREEFOLD_REPETITION, None)
    return None
