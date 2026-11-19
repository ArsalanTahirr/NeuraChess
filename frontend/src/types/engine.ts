import type { PlayerColor } from './chess';

export type EvaluationMode = 'material' | 'neural';
export type ConnectionStatus = 'checking' | 'connected' | 'offline';

export interface SearchOptions {
  evaluationMode: EvaluationMode;
  maxDepth: number;
  timeLimitMs: number;
}

export interface MateScore {
  winner: PlayerColor;
  plies: number;
}

export interface SearchResult {
  fen: string;
  evaluationMode: EvaluationMode;
  move: string | null; // UCI
  san: string | null;
  scoreCp: number | null; // White-relative centipawns
  mate: MateScore | null;
  depth: number;
  timeMs: number;
  status: 'completed' | 'time-limit' | 'terminal';
}
