import type { SearchOptions, SearchResult } from './engine';

export type PieceColor = 'w' | 'b';
export type Square = string;
export type PlayerColor = 'white' | 'black';
export type BoardTheme = 'classic' | 'lichess' | 'midnight' | 'slate';
export type PieceTheme = 'standard' | 'neo' | 'alpha';

export interface MoveRecord {
  san: string;
  uci: string;
  fen: string;
  moveNumber: number;
  color: PieceColor;
  captured: string | null;
  timeMs: number | null;
}

export interface GameOutcome {
  result: PlayerColor | 'draw';
  reason:
    | 'checkmate'
    | 'stalemate'
    | 'resignation'
    | 'insufficient-material'
    | 'threefold-repetition'
    | 'fivefold-repetition'
    | 'fifty-move'
    | 'seventyfive-move';
  winner: PlayerColor | null;
}

export interface CapturedPieces {
  white: string[];
  black: string[];
}

export interface GameOptions extends SearchOptions {
  playerColor: PlayerColor;
}

export interface GameState {
  id: string;
  revision: number;
  settings: GameOptions;
  initialFen: string;
  fen: string;
  turn: PieceColor;
  isCheck: boolean;
  outcome: GameOutcome | null;
  moveHistory: MoveRecord[];
  lastSearch: SearchResult | null;
}
