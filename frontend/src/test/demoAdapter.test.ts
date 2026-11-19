import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { DemoAdapter } from '@/api/demoAdapter';

describe('DemoAdapter', () => {
  it('reports capabilities truthfully without fabricating neural features', async () => {
    const adapter = new DemoAdapter();
    const caps = await adapter.getCapabilities();

    expect(caps.mode).toBe('demo');
    expect(caps.supportsAnalysis).toBe(false);
    expect(caps.supportsEvaluation).toBe(false);
    expect(caps.supportsMultiPV).toBe(false);
  });

  it('selects and plays genuine legal chess moves', async () => {
    const adapter = new DemoAdapter();
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const res = await adapter.getBestMove({ fen: startFen, timeLimit: 100 });
    expect(res.move).toBeTruthy();

    // Verify move is strictly legal in chess.js
    const chess = new Chess(startFen);
    const from = res.move.slice(0, 2);
    const to = res.move.slice(2, 4);
    const promotion = res.move.length > 4 ? res.move[4] : undefined;

    const moveResult = chess.move({ from, to, promotion });
    expect(moveResult).not.toBeNull();
    expect(res.score).toBeNull(); // Truthful: no fake evaluation
    expect(res.depth).toBeNull(); // Truthful: no fake depth
  });

  it('aborts calculation cleanly when requested', async () => {
    const adapter = new DemoAdapter();
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const promise = adapter.getBestMove({ fen: startFen, timeLimit: 2000 });
    // Abort after 50ms
    setTimeout(() => adapter.abort(), 50);

    await expect(promise).rejects.toThrow('Engine operation aborted');
  });
});
