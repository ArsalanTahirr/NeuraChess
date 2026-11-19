export interface EngineCapabilities {
  supportsAnalysis: boolean;
  supportsEvaluation: boolean;
  supportsMultiPV: boolean;
  maxDepth: number;
  engineName: string;
  engineVersion: string;
  mode: 'demo' | 'neural' | 'full';
}

export interface BestMoveRequest {
  fen: string;
  timeLimit?: number;
  maxDepth?: number;
  multiPV?: number;
}

export interface BestMoveResponse {
  move: string; // UCI format e.g. "e2e4"
  score: number | null; // centipawns from mover's perspective, null if unavailable
  depth: number | null;
  nodes: number | null;
  time: number | null; // ms
  pv: string[] | null; // principal variation in UCI
  mateIn: number | null;
}

export interface AnalysisRequest {
  fen: string;
  depth?: number;
  multiPV?: number;
}

export interface AnalysisResponse {
  fen: string;
  score: number | null; // centipawns from WHITE's perspective
  depth: number | null;
  nodes: number | null;
  time: number | null;
  pv: string[] | null;
  mateIn: number | null;
  evaluation: 'centipawn' | 'mate' | 'unknown';
}

export interface EngineStatus {
  connected: boolean;
  thinking: boolean;
  mode: 'demo' | 'neural' | 'full';
  error: string | null;
}
