import { Chess, type Square, type PieceSymbol, type Color } from 'chess.js';
import type { CapturedPieces, MoveRecord } from '@/types/chess';
import type { MateScore } from '@/types/engine';

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export function getCapturedPieces(moves: MoveRecord[]): CapturedPieces {
  const captured: CapturedPieces = { white: [], black: [] };
  for (const move of moves) {
    if (move.captured) captured[move.color === 'w' ? 'white' : 'black'].push(move.captured);
  }
  return captured;
}

export function calculateMaterialAdvantage(chess: Chess): { white: number; black: number } {
  let balance = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece) balance += (piece.color === 'w' ? 1 : -1) * PIECE_VALUES[piece.type];
    }
  }
  return { white: Math.max(0, balance), black: Math.max(0, -balance) };
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

export function formatEvaluation(scoreCp: number | null, mate: MateScore | null): string {
  if (mate) {
    const winner = mate.winner === 'white' ? 'White' : 'Black';
    if (mate.plies === 0) return `${winner} wins`;
    return `${winner} mates in ${mate.plies} ${mate.plies === 1 ? 'ply' : 'plies'}`;
  }
  if (scoreCp === null) return '—';
  const pawns = (scoreCp / 100).toFixed(1);
  return scoreCp > 0 ? `+${pawns}` : pawns;
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
