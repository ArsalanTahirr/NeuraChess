import type {
  BestMoveRequest,
  BestMoveResponse,
  AnalysisRequest,
  AnalysisResponse,
  EngineCapabilities,
} from '@/types/engine';

export interface EngineAdapter {
  getCapabilities(): Promise<EngineCapabilities>;
  getBestMove(req: BestMoveRequest): Promise<BestMoveResponse>;
  analyzePosition(req: AnalysisRequest): Promise<AnalysisResponse>;
  healthCheck(): Promise<boolean>;
  abort(): void;
}
