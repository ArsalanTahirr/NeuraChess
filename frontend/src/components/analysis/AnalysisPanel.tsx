import type { EvaluationMode, SearchResult } from '@/types/engine';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatEvaluation, formatMoveTime } from '@/lib/chessUtils';
import { Terminal, Cpu } from 'lucide-react';

interface AnalysisPanelProps {
  result: SearchResult | null;
  isAnalyzing: boolean;
  error: string | null;
  evaluationMode: EvaluationMode;
  onEvaluationMode: (mode: EvaluationMode) => void;
  onAnalyze: () => void;
  onPlayBestMove?: () => void;
}

export function AnalysisPanel({
  result, isAnalyzing, error, evaluationMode, onEvaluationMode, onAnalyze, onPlayBestMove,
}: AnalysisPanelProps) {
  const metrics = [
    ['Evaluation', formatEvaluation(result?.scoreCp ?? null, result?.mate ?? null)],
    ['Depth', result?.depth ?? '—'],
    ['Search Time', result ? formatMoveTime(result.timeMs) : '—'],
  ];

  return (
    <div className="flex flex-col gap-3 p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
        <Cpu className="w-4 h-4 text-[var(--color-accent-bright)]" />
        <span className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--color-text-secondary)]">
          Position Analysis
        </span>
      </div>

      <div className="flex gap-2">
        <Select aria-label="Evaluation mode" value={evaluationMode} onChange={(event) => onEvaluationMode(event.target.value as EvaluationMode)}>
          <option value="material">Material</option>
          <option value="neural">Neural</option>
        </Select>
        <Button variant="primary" size="md" onClick={onAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? 'Analyzing…' : 'Analyze Position'}
        </Button>
      </div>

      {error && <p role="alert" className="text-xs text-[#f85149]">{error}</p>}

      <div className="grid grid-cols-3 gap-2" aria-live="polite" aria-busy={isAnalyzing}>
        {metrics.map(([label, value]) => (
          <div key={label} className="p-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
            <span className="block text-[10px] font-mono uppercase text-[var(--color-text-tertiary)] mb-0.5">
              {label}
            </span>
            <span className="text-base font-mono font-bold text-[var(--color-text-primary)]">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        <span className="text-xs font-mono font-medium tracking-wider uppercase text-[var(--color-text-secondary)] flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          Best Move
        </span>
        <div className="p-2.5 min-h-[48px] bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] font-mono text-xs text-[var(--color-text-secondary)] flex items-center justify-between gap-2 overflow-x-auto">
          <span>{result?.move ? `${result.san} (${result.move})` : result?.status === 'terminal' ? 'Game over' : '—'}</span>
          {onPlayBestMove && <Button size="sm" onClick={onPlayBestMove}>Play best move</Button>}
        </div>
      </div>
      {result?.status === 'time-limit' && (
        <p className="text-xs font-mono text-[var(--color-text-tertiary)]">Time limit reached</p>
      )}
    </div>
  );
}

export default AnalysisPanel;
