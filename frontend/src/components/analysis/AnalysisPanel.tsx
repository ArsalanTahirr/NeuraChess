import React from 'react';
import type { AnalysisResponse } from '@/types/engine';
import { Badge } from '@/components/ui/Badge';
import { formatEvaluation, formatMoveTime } from '@/lib/chessUtils';
import { Terminal, Cpu, Info } from 'lucide-react';

interface AnalysisPanelProps {
  result: AnalysisResponse | null;
  isAnalyzing: boolean;
  isDemoMode: boolean;
}

export function AnalysisPanel({ result, isAnalyzing, isDemoMode }: AnalysisPanelProps) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--color-accent-bright)]" />
          <span className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--color-text-secondary)]">
            Analytical Intelligence
          </span>
        </div>
        <Badge variant={isDemoMode ? 'warning' : 'accent'} size="sm">
          {isDemoMode ? 'Demo Mode' : 'Stockfish / PyTorch'}
        </Badge>
      </div>

      {/* Demo Mode Notice */}
      {isDemoMode && (
        <div className="p-3 bg-[var(--color-surface-raised)] border border-[var(--color-border-muted)] rounded-[var(--radius-sm)] flex gap-2.5 items-start">
          <Info className="w-4 h-4 text-[var(--color-accent-bright)] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text-primary)]">
              Backend Analysis Offline
            </span>
            <p className="leading-relaxed">
              Position visualization and local move inspection are fully active. Full neural evaluation, iterative deepening, and PV tree exploration require the NeuraChess Python FastAPI service.
            </p>
            <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] mt-1">
              Start with: <code className="text-[var(--color-accent-bright)]">uvicorn main:app --port 8000</code>
            </span>
          </div>
        </div>
      )}

      {/* Numerical Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
          <span className="block text-[10px] font-mono uppercase text-[var(--color-text-tertiary)] mb-0.5">
            Evaluation
          </span>
          <span className="text-base font-mono font-bold text-[var(--color-text-primary)]">
            {isDemoMode
              ? '—'
              : formatEvaluation(result?.score ?? null, result?.mateIn ?? null)}
          </span>
        </div>

        <div className="p-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
          <span className="block text-[10px] font-mono uppercase text-[var(--color-text-tertiary)] mb-0.5">
            Depth
          </span>
          <span className="text-base font-mono font-bold text-[var(--color-text-primary)]">
            {isDemoMode ? '—' : result?.depth ?? '—'}
          </span>
        </div>

        <div className="p-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
          <span className="block text-[10px] font-mono uppercase text-[var(--color-text-tertiary)] mb-0.5">
            Nodes
          </span>
          <span className="text-base font-mono font-bold text-[var(--color-text-primary)]">
            {isDemoMode
              ? '—'
              : result?.nodes
              ? result.nodes.toLocaleString()
              : '—'}
          </span>
        </div>

        <div className="p-2.5 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
          <span className="block text-[10px] font-mono uppercase text-[var(--color-text-tertiary)] mb-0.5">
            Search Time
          </span>
          <span className="text-base font-mono font-bold text-[var(--color-text-primary)]">
            {isDemoMode ? '—' : formatMoveTime(result?.time ?? null) || '—'}
          </span>
        </div>
      </div>

      {/* Principal Variation */}
      <div className="flex flex-col gap-1.5 mt-1">
        <span className="text-xs font-mono font-medium tracking-wider uppercase text-[var(--color-text-secondary)] flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          Principal Variation (PV)
        </span>

        <div className="p-2.5 min-h-[48px] bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] font-mono text-xs text-[var(--color-text-secondary)] flex items-center overflow-x-auto">
          {isDemoMode ? (
            <span className="italic text-[var(--color-text-tertiary)]">
              No variation computed (connect engine server)
            </span>
          ) : result?.pv && result.pv.length > 0 ? (
            <div className="flex items-center gap-2 whitespace-nowrap">
              {result.pv.map((move, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-[2px] text-[var(--color-accent-bright)]"
                >
                  {move}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[var(--color-text-tertiary)]">Awaiting position calculation...</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalysisPanel;
