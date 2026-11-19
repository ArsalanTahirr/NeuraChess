export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = string;

export interface MoveRecord {
  san: string;
  uci: string;
  fen: string;
  moveNumber: number;
  color: PieceColor;
  captured?: string;
  isCheck?: boolean;
  timeMs?: number;
}

export interface GameOutcome {
  result: 'white' | 'black' | 'draw';
  reason:
    | 'checkmate'
    | 'stalemate'
    | 'resignation'
    | 'insufficient-material'
    | 'threefold-repetition'
    | 'fifty-move'
    | 'agreement';
  winner: 'white' | 'black' | null;
}

export interface CapturedPieces {
  white: string[]; // pieces captured by white (black pieces taken)
  black: string[]; // pieces captured by black (white pieces taken)
}

export interface GameState {
  fen: string;
  pgn: string;
  turn: PieceColor;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  outcome: GameOutcome | null;
  moveHistory: MoveRecord[];
  currentMoveIndex: number;
  lastMove: { from: Square; to: Square } | null;
  capturedPieces: CapturedPieces;
  kingSquare: Square | null;
}

export type GameMode = 'play' | 'analysis';
export type PlayerColor = 'white' | 'black';
export type BoardTheme = 'classic' | 'lichess' | 'midnight' | 'slate';
export type PieceTheme = 'standard' | 'neo' | 'alpha';
