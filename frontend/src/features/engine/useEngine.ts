import { useState, useEffect, useRef, useCallback } from 'react';
import type { EngineAdapter } from '@/api/adapter';
import type {
  EngineCapabilities,
  EngineStatus,
  BestMoveRequest,
  BestMoveResponse,
  AnalysisRequest,
  AnalysisResponse,
} from '@/types/engine';

export function useEngine(adapter: EngineAdapter) {
  const [capabilities, setCapabilities] = useState<EngineCapabilities | null>(null);
  const [status, setStatus] = useState<EngineStatus>({
    connected: false,
    thinking: false,
    mode: 'demo',
    error: null,
  });
  const [lastResponse, setLastResponse] = useState<BestMoveResponse | null>(null);

  // Initialize engine & capability detection
  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const isHealthy = await adapter.healthCheck();
        if (!mounted) return;

        if (isHealthy) {
          const caps = await adapter.getCapabilities();
          if (!mounted) return;
          setCapabilities(caps);
          setStatus((prev) => ({
            ...prev,
            connected: true,
            mode: caps.mode,
            error: null,
          }));
        } else {
          setStatus((prev) => ({
            ...prev,
            connected: false,
            error: 'Engine offline',
          }));
        }
      } catch (err) {
        if (!mounted) return;
        setStatus((prev) => ({
          ...prev,
          connected: false,
          error: (err as Error).message,
        }));
      }
    }

    check();

    return () => {
      mounted = false;
      adapter.abort();
    };
  }, [adapter]);

  const requestMove = useCallback(
    async (req: BestMoveRequest): Promise<BestMoveResponse | null> => {
      setStatus((prev) => ({ ...prev, thinking: true, error: null }));

      try {
        const res = await adapter.getBestMove(req);
        setLastResponse(res);
        setStatus((prev) => ({ ...prev, thinking: false }));
        return res;
      } catch (err) {
        const errorMsg = (err as Error).message;
        if (errorMsg !== 'Engine operation aborted') {
          setStatus((prev) => ({ ...prev, thinking: false, error: errorMsg }));
        } else {
          setStatus((prev) => ({ ...prev, thinking: false }));
        }
        return null;
      }
    },
    [adapter]
  );

  const requestAnalysis = useCallback(
    async (req: AnalysisRequest): Promise<AnalysisResponse | null> => {
      try {
        return await adapter.analyzePosition(req);
      } catch (err) {
        return null;
      }
    },
    [adapter]
  );

  const abort = useCallback(() => {
    adapter.abort();
    setStatus((prev) => ({ ...prev, thinking: false }));
  }, [adapter]);

  return {
    capabilities,
    status,
    lastResponse,
    requestMove,
    requestAnalysis,
    abort,
  };
}
