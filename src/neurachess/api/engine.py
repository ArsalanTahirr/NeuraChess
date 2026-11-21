import logging
import math
from collections.abc import Callable
from pathlib import Path
from threading import BoundedSemaphore, Lock
from time import perf_counter
from typing import TYPE_CHECKING

import chess

from neurachess.api.errors import ApiError
from neurachess.api.game import board_outcome
from neurachess.api.schemas import MateScore, SearchOptions, SearchResult
from neurachess.evaluation import MATE_SCORE, classical_evaluate
from neurachess.search import iterative_deepening_timed

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from neurachess.neural.evaluator import NeuralEvaluator


class Engine:
    def __init__(self, checkpoint: Path):
        self.checkpoint = checkpoint
        self._neural_evaluator: NeuralEvaluator | None = None
        self._model_lock = Lock()
        self._search_slots = BoundedSemaphore(2)

    def _get_neural_evaluator(self) -> Callable[[chess.Board], float]:
        with self._model_lock:
            if self._neural_evaluator is None:
                try:
                    from neurachess.neural.evaluator import NeuralEvaluator

                    self._neural_evaluator = NeuralEvaluator(
                        self.checkpoint, require_architecture=True
                    )
                except Exception as exc:
                    logger.exception(
                        "Cannot load neural checkpoint %s", self.checkpoint
                    )
                    raise ApiError(
                        503,
                        "neural_unavailable",
                        "The neural checkpoint could not be loaded. Check the server "
                        "checkpoint configuration or select Material evaluation.",
                    ) from exc
            return self._neural_evaluator.for_search()

    def search(self, board: chess.Board, options: SearchOptions) -> SearchResult:
        if not self._search_slots.acquire(blocking=False):
            raise ApiError(
                503, "engine_busy", "The engine is busy. Please retry shortly."
            )
        try:
            return self._search(board, options)
        except ApiError:
            raise
        except Exception as exc:
            logger.exception("Engine search failed")
            raise ApiError(
                500, "search_failed", "The engine could not search this position."
            ) from exc
        finally:
            self._search_slots.release()

    def _search(self, board: chess.Board, options: SearchOptions) -> SearchResult:
        evaluator = (
            self._get_neural_evaluator()
            if options.evaluation_mode == "neural"
            else classical_evaluate
        )
        fen = board.fen()
        outcome = board_outcome(board)
        if outcome is not None:
            mate = MateScore(winner=outcome.winner, plies=0) if outcome.winner else None
            return SearchResult(
                fen=fen,
                evaluation_mode=options.evaluation_mode,
                move=None,
                san=None,
                score_cp=None if mate else 0,
                mate=mate,
                depth=0,
                time_ms=0,
                status="terminal",
            )

        start = perf_counter()
        move, root_score, depth = iterative_deepening_timed(
            board, options.max_depth, options.time_limit_ms / 1000, evaluator
        )
        elapsed = round((perf_counter() - start) * 1000)
        if (
            move is None
            or move not in board.legal_moves
            or not math.isfinite(root_score)
        ):
            raise ValueError("The search did not return a legal move and finite score.")

        white_score = root_score if board.turn == chess.WHITE else -root_score
        mate = None
        # Timed negamax reserves this range for root-relative mate-distance scores.
        if depth > 0 and MATE_SCORE - 1000 <= abs(white_score) <= MATE_SCORE:
            mate = MateScore(
                winner="white" if white_score > 0 else "black",
                plies=MATE_SCORE - int(abs(white_score)),
            )
        return SearchResult(
            fen=fen,
            evaluation_mode=options.evaluation_mode,
            move=move.uci(),
            san=board.san(move),
            score_cp=None if mate else white_score,
            mate=mate,
            depth=depth,
            time_ms=elapsed,
            status="completed" if depth == options.max_depth else "time-limit",
        )
