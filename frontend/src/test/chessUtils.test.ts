import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  calculateMaterialAdvantage,
  getCapturedPieces,
  formatEvaluation,
  validateFen,
  parseUciMove,
} from '@/lib/chessUtils';
import type { MoveRecord } from '@/types/chess';

describe('chessUtils', () => {
  it('calculates initial material and tracks recorded captures', () => {
    const chess = new Chess();
    expect(getCapturedPieces([])).toEqual({ white: [], black: [] });
    expect(calculateMaterialAdvantage(chess)).toEqual({ white: 0, black: 0 });

    const history: MoveRecord[] = ['e4', 'd5', 'exd5'].map((san) => {
      const move = chess.move(san);
      return {
        san,
        uci: move.lan,
        fen: move.after,
        color: move.color,
        moveNumber: 1,
        captured: move.captured ?? null,
        timeMs: null,
      };
    });
    expect(getCapturedPieces(history)).toEqual({ white: ['p'], black: [] });
    expect(calculateMaterialAdvantage(chess)).toEqual({ white: 1, black: 0 });
  });

  it('calculates material in an imported position without inventing captures', () => {
    const chess = new Chess('4k3/8/8/8/8/8/8/R3K3 b - - 0 1');
    expect(getCapturedPieces([])).toEqual({ white: [], black: [] });
    expect(calculateMaterialAdvantage(chess)).toEqual({ white: 5, black: 0 });
  });

  it('validates FEN syntax for analysis', () => {
    expect(validateFen(new Chess().fen())).toEqual({ valid: true });
    expect(validateFen('completely invalid fen string').valid).toBe(false);
  });

  it('formats White-relative centipawns in pawns and shows mate separately', () => {
    expect(formatEvaluation(150, null)).toBe('+1.5');
    expect(formatEvaluation(-240, null)).toBe('-2.4');
    expect(formatEvaluation(0, null)).toBe('0.0');
    expect(formatEvaluation(null, { winner: 'white', plies: 1 })).toBe('White mates in 1 ply');
    expect(formatEvaluation(null, { winner: 'black', plies: 2 })).toBe('Black mates in 2 plies');
    expect(formatEvaluation(null, { winner: 'white', plies: 0 })).toBe('White wins');
    expect(formatEvaluation(null, null)).toBe('—');
  });

  it('parses UCI moves including promotion', () => {
    expect(parseUciMove('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
    expect(parseUciMove('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });
});
