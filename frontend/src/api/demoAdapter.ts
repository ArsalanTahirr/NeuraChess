import { Chess } from 'chess.js';
import type { EngineAdapter } from './adapter';
import type {
  BestMoveRequest,
  BestMoveResponse,
  AnalysisRequest,
  AnalysisResponse,
  EngineCapabilities,
} from '@/types/engine';

function selectDemoMove(fen: string): { moveUci: string; moveSan: string } | null {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Tactical prioritization for demo:
    // 1. Checks and checkmates
    const checkmate = moves.find((m) => {
      const c = new Chess(fen);
      c.move(m);
      return c.isCheckmate();
    });
    if (checkmate) return { moveUci: checkmate.from + checkmate.to + (checkmate.promotion || ''), moveSan: checkmate.san };

    // 2. High value captures
    const captures = moves.filter((m) => m.captured);
    if (captures.length > 0 && Math.random() < 0.65) {
      const picked = captures[Math.floor(Math.random() * captures.length)];
      return { moveUci: picked.from + picked.to + (picked.promotion || ''), moveSan: picked.san };
    }

    // 3. Center pawn moves and piece development in opening
    const centerMoves = moves.filter(
      (m) =>
        ['d4', 'd5', 'e4', 'e5', 'Nf3', 'Nc3', 'Nf6', 'Nc6', 'c4', 'c5'].includes(m.san) ||
        ['d4', 'e4', 'd5', 'e5'].includes(m.to)
    );
    if (centerMoves.length > 0 && moves.length > 15 && Math.random() < 0.5) {
      const picked = centerMoves[Math.floor(Math.random() * centerMoves.length)];
      return { moveUci: picked.from + picked.to + (picked.promotion || ''), moveSan: picked.san };
    }

    // 4. Random legal move
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return { moveUci: randomMove.from + randomMove.to + (randomMove.promotion || ''), moveSan: randomMove.san };
  } catch {
    return null;
  }
}

export class DemoAdapter implements EngineAdapter {
  private isAborted = false;

  abort(): void {
    this.isAborted = true;
  }

  async getCapabilities(): Promise<EngineCapabilities> {
    return {
      supportsAnalysis: false,
      supportsEvaluation: false,
      supportsMultiPV: false,
      maxDepth: 1,
      engineName: 'NeuraChess Local Demo',
      engineVersion: '0.1.0-demo',
      mode: 'demo',
    };
  }

  async getBestMove(req: BestMoveRequest): Promise<BestMoveResponse> {
    this.isAborted = false;
    const requestedTime = req.timeLimit ?? 1000;
    // Natural thinking delay between 400ms and requestedTime
    const delay = Math.min(requestedTime, 400 + Math.random() * 500);

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.isAborted) {
      throw new Error('Engine operation aborted');
    }

    const selection = selectDemoMove(req.fen);
    if (!selection) {
      throw new Error('No legal moves available');
    }

    // Return genuine move, but truthfully leave evaluation metrics as null
    return {
      move: selection.moveUci,
      score: null,
      depth: null,
      nodes: null,
      time: Math.round(delay),
      pv: [selection.moveUci],
      mateIn: null,
    };
  }

  async analyzePosition(req: AnalysisRequest): Promise<AnalysisResponse> {
    return {
      fen: req.fen,
      score: null,
      depth: null,
      nodes: null,
      time: null,
      pv: null,
      mateIn: null,
      evaluation: 'unknown',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
