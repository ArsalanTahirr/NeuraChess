import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';
import { ApiError, backend } from '@/api/backendAdapter';
import type { GameOptions, GameState, PlayerColor } from '@/types/chess';
import type { ConnectionStatus } from '@/types/engine';
import { findKingSquare, getCapturedPieces, calculateMaterialAdvantage, parseUciMove } from '@/lib/chessUtils';
import { readSavedValue, saveValue } from '@/lib/browserStorage';

const GAME_STORAGE_KEY = 'neurachess_active_game';
const ORIENTATION_STORAGE_KEY = 'neurachess_board_orientation';

function isPlayerTurn(game: GameState): boolean {
  return game.turn === (game.settings.playerColor === 'white' ? 'w' : 'b');
}

async function replacePosition(previous: GameState | null, settings: GameOptions, fen?: string) {
  if (previous) {
    try {
      return await backend.reset(previous, settings, fen);
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.code !== 'game_not_found') throw cause;
    }
  }
  return backend.createGame(settings, fen);
}

async function resumeEngineTurn(game: GameState, signal: AbortSignal): Promise<GameState> {
  try {
    return await backend.engineMove(game, signal);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.code !== 'search_in_progress') throw cause;
  }

  // A refresh can leave the previous page's search running on the server.
  const deadline = Date.now() + game.settings.timeLimitMs + 1500;
  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    signal.throwIfAborted();
    const latest = await backend.getGame(game.id, signal);
    if (latest.revision !== game.revision) return latest;
  }
  return backend.engineMove(game, signal);
}

export function useGameState(
  defaultPlayerColor: PlayerColor,
  connection: ConnectionStatus,
  playSound: (capture: boolean) => Promise<void>,
) {
  const [savedGameId, setSavedGameId] = useState(() => readSavedValue(GAME_STORAGE_KEY));
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [game, setGame] = useState<GameState | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [orientation, setOrientation] = useState(defaultPlayerColor);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<GameState | null>(null);
  const mutating = useRef(false);
  const search = useRef<AbortController | null>(null);

  const applySnapshot = useCallback((next: GameState) => {
    const previous = current.current;
    if (previous?.id === next.id && previous.revision >= next.revision) return;
    if (previous?.id === next.id && next.moveHistory.length === previous.moveHistory.length + 1) {
      void playSound(Boolean(next.moveHistory[next.moveHistory.length - 1].captured));
    }
    search.current?.abort();
    search.current = null;
    current.current = next;
    saveValue(GAME_STORAGE_KEY, next.id);
    setThinking(false);
    setGame(next);
  }, [playSound]);

  const recover = useCallback(async (cause: unknown, previous: GameState | null) => {
    if (!(cause instanceof ApiError) || !previous || current.current !== previous) return;
    if (cause.code === 'game_not_found') {
      search.current?.abort();
      search.current = null;
      current.current = null;
      saveValue(GAME_STORAGE_KEY, null);
      saveValue(ORIENTATION_STORAGE_KEY, null);
      setGame(null);
      setReviewIndex(null);
      setThinking(false);
    }
    if (['stale_game', 'request_timeout', 'offline'].includes(cause.code)) {
      const latest = await backend.getGame(previous.id).catch(() => null);
      if (latest && current.current === previous) applySnapshot(latest);
    }
  }, [applySnapshot]);

  const mutate = useCallback(async (
    action: (previous: GameState | null) => Promise<GameState>,
    reportError = true,
  ) => {
    if (mutating.current) throw new Error('A game update is already in progress.');
    mutating.current = true;
    setBusy(true);
    if (reportError) setError(null);
    const previous = current.current;
    try {
      const next = await action(previous);
      applySnapshot(next);
      setReviewIndex(null);
      setError(null);
    } catch (cause) {
      await recover(cause, previous);
      if (reportError) setError((cause as Error).message);
      throw cause;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }, [applySnapshot, recover]);

  const newGame = useCallback(async (settings: GameOptions) => {
    await mutate((previous) => replacePosition(previous, settings));
    setSavedGameId(null);
    setRestoreError(null);
    setOrientation(settings.playerColor);
    saveValue(ORIENTATION_STORAGE_KEY, settings.playerColor);
  }, [mutate]);

  useEffect(() => {
    if (!savedGameId || connection !== 'connected') return;
    const controller = new AbortController();
    setRestoreError(null);

    const restore = async () => {
      try {
        const snapshot = await backend.getGame(savedGameId, controller.signal);
        if (controller.signal.aborted) return;
        const savedOrientation = readSavedValue(ORIENTATION_STORAGE_KEY);
        setOrientation(savedOrientation === 'white' || savedOrientation === 'black'
          ? savedOrientation : snapshot.settings.playerColor);
        applySnapshot(snapshot);
        setSavedGameId(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.code === 'game_not_found') {
          saveValue(GAME_STORAGE_KEY, null);
          saveValue(ORIENTATION_STORAGE_KEY, null);
          setSavedGameId(null);
          setError('The saved match expired. Start a new match to continue.');
        } else {
          setRestoreError((cause as Error).message);
        }
      }
    };

    void restore();
    return () => controller.abort();
  }, [savedGameId, connection, restoreAttempt, applySnapshot]);

  const requestEngineMove = useCallback(async () => {
    const previous = current.current;
    if (!previous || previous.outcome || isPlayerTurn(previous) || search.current) return;
    const controller = new AbortController();
    search.current = controller;
    setThinking(true);
    setError(null);
    try {
      const next = await resumeEngineTurn(previous, controller.signal);
      if (current.current === previous && !controller.signal.aborted) applySnapshot(next);
    } catch (cause) {
      if (controller.signal.aborted || current.current !== previous) return;
      if (mutating.current && cause instanceof ApiError && cause.code === 'stale_game') return;
      await recover(cause, previous);
      if (current.current === previous || !current.current) setError((cause as Error).message);
    } finally {
      if (search.current === controller) {
        search.current = null;
        setThinking(false);
      }
    }
  }, [applySnapshot, recover]);

  useEffect(() => {
    void requestEngineMove();
  }, [game, requestEngineMove]);

  const moveHistory = game?.moveHistory ?? [];
  const latestIndex = moveHistory.length - 1;
  const currentMoveIndex = Math.min(reviewIndex ?? latestIndex, latestIndex);
  const isLiveGame = currentMoveIndex === latestIndex;
  const viewedMove = moveHistory[currentMoveIndex];
  const fen = (isLiveGame ? game?.fen : viewedMove?.fen ?? game?.initialFen) ?? DEFAULT_POSITION;
  const board = useMemo(() => new Chess(fen), [fen]);
  const turn = isLiveGame && game ? game.turn : board.turn();
  const isCheck = isLiveGame && game ? game.isCheck : board.inCheck();
  const playerColor = game?.settings.playerColor ?? defaultPlayerColor;
  const canUndo = Boolean(
    game?.outcome?.reason === 'resignation' ||
    moveHistory.some((move) => move.color === (playerColor === 'white' ? 'w' : 'b')),
  );

  const makeMove = (from: Square, to: Square, promotion: string = 'q'): false | 'pending' => {
    const previous = current.current;
    if (!previous || previous.outcome || !isPlayerTurn(previous) || mutating.current || !isLiveGame) return false;
    const move = board.moves({ square: from, verbose: true }).find(
      (candidate) => candidate.to === to && (!candidate.promotion || candidate.promotion === promotion),
    );
    if (!move) return false;
    void mutate(() => backend.playMove(previous, move.lan)).catch(() => {});
    return 'pending';
  };

  const importFEN = async (position: string) => {
    const previous = current.current;
    if (!previous) throw new Error('Start a match before importing a position.');
    await mutate(
      () => replacePosition(previous, previous.settings, position),
      false,
    );
  };

  const actions = {
    makeMove,
    newGame,
    importFEN,
    undoMove: () => {
      const previous = current.current;
      if (previous) void mutate(() => backend.undo(previous)).catch(() => {});
    },
    resign: () => {
      const previous = current.current;
      if (previous) void mutate(() => backend.resign(previous)).catch(() => {});
    },
    retryEngine: requestEngineMove,
    retryRestore: () => setRestoreAttempt((attempt) => attempt + 1),
    flipBoard: () => {
      const next = orientation === 'white' ? 'black' : 'white';
      setOrientation(next);
      if (current.current) saveValue(ORIENTATION_STORAGE_KEY, next);
    },
    navigateTo: (index: number) => setReviewIndex(index === latestIndex ? null : index),
    returnToLive: () => setReviewIndex(null),
    copyFEN: async () => {
      try {
        await navigator.clipboard.writeText(fen);
        return true;
      } catch {
        return false;
      }
    },
  };

  return {
    fen, turn, isCheck, playerColor, orientation, moveHistory, currentMoveIndex, isLiveGame,
    outcome: game?.outcome ?? null,
    isGameOver: Boolean(game?.outcome),
    kingSquare: isCheck ? findKingSquare(board, turn) : null,
    lastMove: viewedMove ? parseUciMove(viewedMove.uci) : null,
    capturedPieces: getCapturedPieces(moveHistory.slice(0, currentMoveIndex + 1)),
    materialAdvantage: calculateMaterialAdvantage(board),
    lastSearch: isLiveGame ? game?.lastSearch ?? null : null,
    evaluationMode: game?.settings.evaluationMode ?? null,
    busy, thinking, error,
    hasGame: game !== null,
    pendingRestore: savedGameId !== null,
    restoreError,
    canMove: Boolean(game && isPlayerTurn(game)) && !busy && !thinking,
    canUndo: canUndo && isLiveGame && !busy,
    canRetry: Boolean(game && !game.outcome && !isPlayerTurn(game) && error && !busy && !thinking),
    actions,
  };
}
