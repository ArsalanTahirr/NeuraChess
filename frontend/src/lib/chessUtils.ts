import { Chess, type Square, type PieceSymbol, type Color } from 'chess.js';
import type { CapturedPieces, GameOutcome, MoveRecord } from '@/types/chess';

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const INITIAL_PIECES = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
};

export function getCapturedPieces(chess: Chess): CapturedPieces {
  const currentCounts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  const board = chess.board();
  for (const row of board) {
    for (const square of row) {
      if (square && square.type !== 'k') {
        currentCounts[square.color][square.type]++;
      }
    }
  }

  const whiteCaptured: string[] = []; // pieces lost by black, taken by white
  const blackCaptured: string[] = []; // pieces lost by white, taken by black

  for (const [piece, initial] of Object.entries(INITIAL_PIECES)) {
    const type = piece as keyof typeof INITIAL_PIECES;
    const missingWhite = initial - currentCounts.w[type];
    for (let i = 0; i < missingWhite; i++) {
      blackCaptured.push(type.toUpperCase());
    }

    const missingBlack = initial - currentCounts.b[type];
    for (let i = 0; i < missingBlack; i++) {
      whiteCaptured.push(type.toLowerCase());
    }
  }

  return {
    white: whiteCaptured,
    black: blackCaptured,
  };
}

export function calculateMaterialAdvantage(captured: CapturedPieces): {
  white: number;
  black: number;
} {
  let whiteScore = 0;
  for (const piece of captured.white) {
    whiteScore += PIECE_VALUES[piece.toLowerCase() as PieceSymbol] || 0;
  }

  let blackScore = 0;
  for (const piece of captured.black) {
    blackScore += PIECE_VALUES[piece.toLowerCase() as PieceSymbol] || 0;
  }

  return {
    white: Math.max(0, whiteScore - blackScore),
    black: Math.max(0, blackScore - whiteScore),
  };
}

export function classifyGameOutcome(chess: Chess): GameOutcome | null {
  if (!chess.isGameOver()) return null;

  if (chess.isCheckmate()) {
    const winner: 'white' | 'black' = chess.turn() === 'w' ? 'black' : 'white';
    return {
      result: winner,
      reason: 'checkmate',
      winner,
    };
  }

  if (chess.isStalemate()) {
    return {
      result: 'draw',
      reason: 'stalemate',
      winner: null,
    };
  }

  if (chess.isThreefoldRepetition()) {
    return {
      result: 'draw',
      reason: 'threefold-repetition',
      winner: null,
    };
  }

  if (chess.isInsufficientMaterial()) {
    return {
      result: 'draw',
      reason: 'insufficient-material',
      winner: null,
    };
  }

  // 50-move rule
  return {
    result: 'draw',
    reason: 'fifty-move',
    winner: null,
  };
}

export function findKingSquare(chess: Chess, color: Color): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return piece.square as Square;
      }
    }
  }
  return null;
}

export function formatEvaluation(
  score: number | null,
  mateIn: number | null,
  perspective: 'white' | 'black' = 'white'
): string {
  if (mateIn !== null) {
    const adjustedMate = perspective === 'black' ? -mateIn : mateIn;
    return `M${Math.abs(adjustedMate)}${adjustedMate > 0 ? ' (Win)' : ' (Loss)'}`;
  }

  if (score === null) return '—';

  const adjustedScore = perspective === 'black' ? -score : score;
  const inPawns = (adjustedScore / 100).toFixed(1);
  return adjustedScore > 0 ? `+${inPawns}` : inPawns;
}

export function formatMoveTime(ms: number | null): string {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function validateFen(fen: string): { valid: boolean; error?: string } {
  try {
    const c = new Chess(fen.trim());
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

export function parseUciMove(uci: string): { from: Square; to: Square; promotion?: string } {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  return { from, to, promotion };
}
