import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess, type Square } from 'chess.js';
import type { GameState, MoveRecord, GameOutcome, PlayerColor, CapturedPieces } from '@/types/chess';
import type { EngineAdapter } from '@/api/adapter';
import {
  getCapturedPieces,
  classifyGameOutcome,
  findKingSquare,
  parseUciMove,
} from '@/lib/chessUtils';
import { useEngine } from '@/features/engine/useEngine';

export function useGameState(adapter: EngineAdapter, playerColor: PlayerColor) {
  // Underlying chess.js instance (mutable ref to avoid recreating object)
  const chessRef = useRef<Chess>(new Chess());
  const gameIdRef = useRef<number>(1);

  // Synchronized react state
  const [fen, setFen] = useState<string>(() => chessRef.current.fen());
  const [pgn, setPgn] = useState<string>('');
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>({ white: [], black: [] });
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [isBoardFlipped, setIsBoardFlipped] = useState<boolean>(playerColor === 'black');

  // Engine hook
  const { capabilities, status, lastResponse, requestMove, abort } = useEngine(adapter);

  // Sync board flipping if playerColor changes
  useEffect(() => {
    setIsBoardFlipped(playerColor === 'black');
  }, [playerColor]);

  // Derived state
  const isLiveGame = currentMoveIndex === moveHistory.length - 1;
  const chess = chessRef.current;
  const turn = chess.turn();
  const isCheck = chess.inCheck();
  const isGameOver = outcome !== null || chess.isGameOver();
  const kingSquare = isCheck ? findKingSquare(chess, turn) : null;

  // Refresh view from the underlying chess position
  const syncState = useCallback((moveRecord?: MoveRecord, targetIndex?: number) => {
    const c = chessRef.current;
    const currentFen = c.fen();
    setFen(currentFen);
    setPgn(c.pgn());
    setCapturedPieces(getCapturedPieces(c));

    const gameOutcome = classifyGameOutcome(c);
    if (gameOutcome) {
      setOutcome(gameOutcome);
    }

    if (moveRecord) {
      setMoveHistory((prev) => {
        const next = [...prev, moveRecord];
        setCurrentMoveIndex(next.length - 1);
        return next;
      });
    } else if (targetIndex !== undefined) {
      setCurrentMoveIndex(targetIndex);
    }
  }, []);

  // Trigger engine move if it's the engine's turn
  const checkAndTriggerEngine = useCallback(
    async (currentGameId: number) => {
      const c = chessRef.current;
      if (c.isGameOver()) return;

      const engineColor = playerColor === 'white' ? 'b' : 'w';
      if (c.turn() !== engineColor) return;

      const currentFen = c.fen();
      const response = await requestMove({ fen: currentFen });

      // Guard against stale response due to newGame, undo, or FEN import
      if (gameIdRef.current !== currentGameId) {
        return;
      }

      if (!response || !response.move) return;

      const { from, to, promotion } = parseUciMove(response.move);

      try {
        const moveResult = c.move({
          from,
          to,
          promotion: promotion || 'q',
        });

        if (moveResult) {
          setLastMove({ from: moveResult.from as Square, to: moveResult.to as Square });

          const moveRecord: MoveRecord = {
            san: moveResult.san,
            uci: response.move,
            fen: c.fen(),
            moveNumber: Math.ceil(c.history().length / 2),
            color: engineColor,
            captured: moveResult.captured,
            isCheck: c.inCheck(),
            timeMs: response.time ?? undefined,
          };

          syncState(moveRecord);
        }
      } catch (err) {
        console.error('Failed to apply engine move:', err);
      }
    },
    [playerColor, requestMove, syncState]
  );

  // Human player makes a move
  const makeMove = useCallback(
    (from: Square, to: Square, promotion: string = 'q'): boolean => {
      const c = chessRef.current;

      // Cannot make moves during review mode or after game over
      if (!isLiveGame && moveHistory.length > 0) return false;
      if (c.isGameOver() || outcome !== null) return false;

      // Enforce player's turn
      const expectedColor = playerColor === 'white' ? 'w' : 'b';
      if (c.turn() !== expectedColor) return false;

      try {
        const moveResult = c.move({
          from,
          to,
          promotion,
        });

        if (!moveResult) return false;

        setLastMove({ from, to });

        const moveRecord: MoveRecord = {
          san: moveResult.san,
          uci: `${from}${to}${moveResult.promotion || ''}`,
          fen: c.fen(),
          moveNumber: Math.ceil(c.history().length / 2),
          color: expectedColor,
          captured: moveResult.captured,
          isCheck: c.inCheck(),
        };

        syncState(moveRecord);

        // Schedule engine response
        const currentGameId = gameIdRef.current;
        setTimeout(() => {
          checkAndTriggerEngine(currentGameId);
        }, 80);

        return true;
      } catch {
        return false;
      }
    },
    [isLiveGame, moveHistory.length, outcome, playerColor, syncState, checkAndTriggerEngine]
  );

  // New game reset
  const newGame = useCallback(() => {
    gameIdRef.current += 1;
    abort();

    const fresh = new Chess();
    chessRef.current = fresh;

    setFen(fresh.fen());
    setPgn('');
    setMoveHistory([]);
    setCurrentMoveIndex(-1);
    setLastMove(null);
    setCapturedPieces({ white: [], black: [] });
    setOutcome(null);

    // If player is Black, engine plays first move as White
    if (playerColor === 'black') {
      const currentGameId = gameIdRef.current;
      setTimeout(() => {
        checkAndTriggerEngine(currentGameId);
      }, 300);
    }
  }, [abort, playerColor, checkAndTriggerEngine]);

  // Undo move (human + engine move = 2 plies, or 1 ply if only human moved)
  const undoMove = useCallback(() => {
    gameIdRef.current += 1;
    abort();

    const c = chessRef.current;
    if (moveHistory.length === 0) return;

    // Check how many moves to undo:
    // If it's human's turn now, engine must have moved last, so undo 2 plies.
    // If it's engine's turn, human just moved, so undo 1 ply.
    const expectedColor = playerColor === 'white' ? 'w' : 'b';
    const pliesToUndo = c.turn() === expectedColor && moveHistory.length >= 2 ? 2 : 1;

    for (let i = 0; i < pliesToUndo; i++) {
      c.undo();
    }

    const nextHistory = moveHistory.slice(0, moveHistory.length - pliesToUndo);
    setMoveHistory(nextHistory);
    setCurrentMoveIndex(nextHistory.length - 1);
    setFen(c.fen());
    setPgn(c.pgn());
    setCapturedPieces(getCapturedPieces(c));
    setOutcome(null);

    if (nextHistory.length > 0) {
      const last = nextHistory[nextHistory.length - 1];
      const { from, to } = parseUciMove(last.uci);
      setLastMove({ from, to });
    } else {
      setLastMove(null);
    }
  }, [abort, moveHistory, playerColor]);

  // Redo move
  const redoMove = useCallback(() => {
    // Redo is active when user navigates history
    if (currentMoveIndex < moveHistory.length - 1) {
      const nextIdx = currentMoveIndex + 1;
      const targetMove = moveHistory[nextIdx];
      navigateTo(nextIdx);
    }
  }, [currentMoveIndex, moveHistory]);

  // History navigation
  const navigateTo = useCallback(
    (index: number) => {
      if (index < -1 || index >= moveHistory.length) return;

      setCurrentMoveIndex(index);

      if (index === -1) {
        // Start position
        const start = new Chess();
        setFen(start.fen());
        setLastMove(null);
      } else {
        const target = moveHistory[index];
        setFen(target.fen);
        const { from, to } = parseUciMove(target.uci);
        setLastMove({ from, to });
      }
    },
    [moveHistory]
  );

  // Return to live game
  const returnToLive = useCallback(() => {
    if (moveHistory.length === 0) {
      navigateTo(-1);
    } else {
      navigateTo(moveHistory.length - 1);
      setFen(chessRef.current.fen());
    }
  }, [moveHistory, navigateTo]);

  // Resignation
  const resign = useCallback(() => {
    if (isGameOver) return;
    const winner = playerColor === 'white' ? 'black' : 'white';
    setOutcome({
      result: winner,
      reason: 'resignation',
      winner,
    });
  }, [isGameOver, playerColor]);

  // Flip board
  const flipBoard = useCallback(() => {
    setIsBoardFlipped((prev) => !prev);
  }, []);

  // Copy FEN
  const copyFEN = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(fen);
      return true;
    } catch {
      return false;
    }
  }, [fen]);

  // Import FEN
  const importFEN = useCallback(
    (newFen: string): boolean => {
      try {
        const c = new Chess(newFen.trim());
        gameIdRef.current += 1;
        abort();

        chessRef.current = c;
        setFen(c.fen());
        setPgn(c.pgn());
        setMoveHistory([]);
        setCurrentMoveIndex(-1);
        setLastMove(null);
        setCapturedPieces(getCapturedPieces(c));
        setOutcome(classifyGameOutcome(c));

        // If turn belongs to engine, trigger calculation
        const engineColor = playerColor === 'white' ? 'b' : 'w';
        if (c.turn() === engineColor && !c.isGameOver()) {
          const currentGameId = gameIdRef.current;
          setTimeout(() => {
            checkAndTriggerEngine(currentGameId);
          }, 200);
        }

        return true;
      } catch {
        return false;
      }
    },
    [abort, playerColor, checkAndTriggerEngine]
  );

  return {
    fen,
    pgn,
    turn,
    isCheck,
    isGameOver,
    kingSquare,
    outcome,
    moveHistory,
    currentMoveIndex,
    lastMove,
    capturedPieces,
    isBoardFlipped,
    isLiveGame,
    engineStatus: status,
    engineCapabilities: capabilities,
    lastEngineResponse: lastResponse,
    actions: {
      makeMove,
      undoMove,
      redoMove,
      navigateTo,
      returnToLive,
      newGame,
      resign,
      flipBoard,
      copyFEN,
      importFEN,
    },
  };
}
