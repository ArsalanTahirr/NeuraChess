import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  calculateMaterialAdvantage,
  getCapturedPieces,
  classifyGameOutcome,
  formatEvaluation,
  validateFen,
  parseUciMove,
} from '@/lib/chessUtils';

describe('chessUtils', () => {
  it('correctly calculates initial material with no captures', () => {
    const chess = new Chess();
    const captured = getCapturedPieces(chess);
    expect(captured.white).toEqual([]);
    expect(captured.black).toEqual([]);

    const adv = calculateMaterialAdvantage(captured);
    expect(adv.white).toBe(0);
    expect(adv.black).toBe(0);
  });

  it('correctly identifies captured pieces and material advantage after captures', () => {
    const chess = new Chess();
    // 1. e4 d5 2. exd5 (White captures black pawn)
    chess.move('e4');
    chess.move('d5');
    chess.move('exd5');

    const captured = getCapturedPieces(chess);
    expect(captured.white).toContain('p');
    expect(captured.black).toEqual([]);

    const adv = calculateMaterialAdvantage(captured);
    expect(adv.white).toBe(1);
    expect(adv.black).toBe(0);
  });

  it('correctly classifies checkmate outcome', () => {
    const chess = new Chess();
    // Scholar's mate: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
    chess.move('e4');
    chess.move('e5');
    chess.move('Bc4');
    chess.move('Nc6');
    chess.move('Qh5');
    chess.move('Nf6');
    chess.move('Qxf7#');

    expect(chess.isCheckmate()).toBe(true);
    const outcome = classifyGameOutcome(chess);
    expect(outcome).not.toBeNull();
    expect(outcome?.result).toBe('white');
    expect(outcome?.reason).toBe('checkmate');
    expect(outcome?.winner).toBe('white');
  });

  it('correctly classifies stalemate outcome', () => {
    // Known stalemate position: 8/8/8/8/8/7k/5Q2/7K b - - 0 1 (Black king on h3, White queen on f2, King on h1)
    // Actually: King on a8, White King on c7, White Queen on b6 - black to move
    const stalemateFen = 'k7/2K5/1Q6/8/8/8/8/8 b - - 0 1';
    const chess = new Chess(stalemateFen);
    expect(chess.isStalemate()).toBe(true);

    const outcome = classifyGameOutcome(chess);
    expect(outcome?.result).toBe('draw');
    expect(outcome?.reason).toBe('stalemate');
    expect(outcome?.winner).toBeNull();
  });

  it('validates legal and illegal FENs properly', () => {
    const valid = validateFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(valid.valid).toBe(true);

    const invalid = validateFen('completely invalid fen string');
    expect(invalid.valid).toBe(false);
  });

  it('formats centipawns and mate evaluation strings accurately', () => {
    expect(formatEvaluation(150, null, 'white')).toBe('+1.5');
    expect(formatEvaluation(-240, null, 'white')).toBe('-2.4');
    expect(formatEvaluation(0, null, 'white')).toBe('0.0');
    expect(formatEvaluation(null, 3, 'white')).toBe('M3 (Win)');
    expect(formatEvaluation(null, -2, 'white')).toBe('M2 (Loss)');
    expect(formatEvaluation(null, null)).toBe('—');
  });

  it('parses UCI move correctly including promotion', () => {
    expect(parseUciMove('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
    expect(parseUciMove('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });
});
