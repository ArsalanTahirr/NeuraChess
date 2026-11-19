import type { EngineAdapter } from './adapter';
import type {
  BestMoveRequest,
  BestMoveResponse,
  AnalysisRequest,
  AnalysisResponse,
  EngineCapabilities,
} from '@/types/engine';

export class BackendAdapter implements EngineAdapter {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getCapabilities(): Promise<EngineCapabilities> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      throw new Error(`Failed to fetch engine capabilities: ${(err as Error).message}`);
    }
  }

  async getBestMove(req: BestMoveRequest): Promise<BestMoveResponse> {
    this.abort();
    this.abortController = new AbortController();

    try {
      const res = await fetch(`${this.baseUrl}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Engine operation aborted');
      }
      throw err;
    } finally {
      this.abortController = null;
    }
  }

  async analyzePosition(req: AnalysisRequest): Promise<AnalysisResponse> {
    this.abort();
    this.abortController = new AbortController();

    try {
      const res = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Analysis operation aborted');
      }
      throw err;
    } finally {
      this.abortController = null;
    }
  }
}
