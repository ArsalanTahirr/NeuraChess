import React from 'react';
import type { EngineStatus as EngineStatusType } from '@/types/engine';
import { ThinkingIndicator } from './ThinkingIndicator';
import { Badge } from '@/components/ui/Badge';
import { formatEvaluation, formatMoveTime } from '@/lib/chessUtils';

interface EngineStatusProps {
  status: EngineStatusType;
  lastResponse: {
    time: number | null;
    depth: number | null;
    nodes: number | null;
    score: number | null;
    mateIn: number | null;
  } | null;
}

export function EngineStatus({ status, lastResponse }: EngineStatusProps) {
  const isDemo = status.mode === 'demo';

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-[var(--color-text-secondary)] font-mono">
            Engine State
          </span>
          <Badge variant={isDemo ? 'warning' : 'accent'} size="sm">
            {isDemo ? 'Demo Mode' : 'Neural Core'}
          </Badge>
        </div>

        {status.connected ? (
          <span className="text-[10px] font-mono text-[#7ee787] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7ee787]" /> Ready
          </span>
        ) : (
          <span className="text-[10px] font-mono text-[#f85149] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f85149]" /> Offline
          </span>
        )}
      </div>

      {/* Center signature thinking indicator */}
      <div className="flex items-center justify-center py-1">
        <ThinkingIndicator isThinking={status.thinking} />
      </div>

      {/* Metrics or honest demo note */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-tertiary)]">
        {isDemo ? (
          <div className="flex items-center justify-between w-full">
            <span>Local move generator</span>
            {lastResponse?.time && <span>{formatMoveTime(lastResponse.time)}</span>}
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span>
              Eval:{' '}
              <strong className="text-[var(--color-text-primary)]">
                {formatEvaluation(lastResponse?.score ?? null, lastResponse?.mateIn ?? null)}
              </strong>
            </span>
            <span>
              Depth: {lastResponse?.depth ?? '—'}
            </span>
            {lastResponse?.time && <span>{formatMoveTime(lastResponse.time)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default EngineStatus;
