import type { GameOptions, GameState } from '@/types/chess';
import type { SearchOptions, SearchResult } from '@/types/engine';

const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  { body, signal, timeoutMs = 15_000 }: {
    body?: object;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) {
      throw new ApiError('request_timeout', 'The chess server took too long to respond. Please retry.');
    }
    throw new ApiError('offline', 'Could not connect to the NeuraChess server. Check that it is running and retry.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      data?.detail?.code ?? 'server_error',
      data?.detail?.message ?? `The chess server returned HTTP ${response.status}.`,
    );
  }
  if (data === null) {
    throw new ApiError('invalid_response', 'The chess server returned an invalid response.');
  }
  return data;
}

export const backend = {
  health(signal: AbortSignal) {
    return request<{ status: 'ok' }>('/health', { signal, timeoutMs: 2500 });
  },
  createGame(settings: GameOptions, fen?: string) {
    return request<GameState>('/games', { body: { ...settings, fen } });
  },
  getGame(id: string, signal?: AbortSignal) {
    return request<GameState>(`/games/${encodeURIComponent(id)}`, { signal });
  },
  reset(game: GameState, settings?: GameOptions, fen?: string) {
    return request<GameState>(`/games/${game.id}/reset`, {
      body: { revision: game.revision, settings, fen },
    });
  },
  playMove(game: GameState, move: string) {
    return request<GameState>(`/games/${game.id}/moves`, {
      body: { revision: game.revision, move },
    });
  },
  engineMove(game: GameState, signal: AbortSignal) {
    return request<GameState>(`/games/${game.id}/engine-move`, {
      body: { revision: game.revision },
      signal,
    });
  },
  undo(game: GameState) {
    return request<GameState>(`/games/${game.id}/undo`, { body: { revision: game.revision } });
  },
  resign(game: GameState) {
    return request<GameState>(`/games/${game.id}/resign`, { body: { revision: game.revision } });
  },
  analyze(fen: string, options: SearchOptions, signal: AbortSignal) {
    return request<SearchResult>('/analyze', { body: { fen, ...options }, signal });
  },
};
