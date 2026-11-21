import type { ConnectionStatus, EvaluationMode, SearchResult } from '@/types/engine';
import { ThinkingIndicator } from './ThinkingIndicator';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatEvaluation, formatMoveTime } from '@/lib/chessUtils';

interface EngineStatusProps {
  connection: ConnectionStatus;
  mode: EvaluationMode | null;
  thinking: boolean;
  error: string | null;
  onRetry?: () => void;
  lastResponse: SearchResult | null;
}

export function EngineStatus({ connection, mode, thinking, error, onRetry, lastResponse }: EngineStatusProps) {
  const message = error ?? (
    connection === 'offline' ? 'Could not connect to the NeuraChess server.' : null
  );

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-[var(--color-text-secondary)] font-mono">
            Engine State
          </span>
          {mode && (
            <Badge variant="accent" size="sm">
              {mode === 'neural' ? 'Neural' : 'Material'}
            </Badge>
          )}
        </div>
        <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">
          {connection === 'offline' ? 'Offline' : connection === 'checking' ? 'Connecting' : null}
        </span>
      </div>

      <div className="flex items-center justify-center py-1">
        <ThinkingIndicator isThinking={thinking} ready={connection === 'connected' && !message} />
      </div>

      {message && <p role="alert" className="text-xs text-[#f85149]">{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry engine move</Button>}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--color-border-subtle)] text-[11px] font-mono text-[var(--color-text-tertiary)]">
        <span>
          Eval{' '}
          <strong className="text-[var(--color-text-primary)]">
            {formatEvaluation(lastResponse?.scoreCp ?? null, lastResponse?.mate ?? null)}
          </strong>
        </span>
        <span>Depth {lastResponse?.depth ?? '—'}</span>
        {lastResponse && <span>{formatMoveTime(lastResponse.timeMs)}</span>}
      </div>
      <span className="h-4 -mt-1 text-[10px] font-mono text-[var(--color-text-tertiary)]">
        {lastResponse?.status === 'time-limit' ? 'Time limit reached' : null}
      </span>
    </div>
  );
}
