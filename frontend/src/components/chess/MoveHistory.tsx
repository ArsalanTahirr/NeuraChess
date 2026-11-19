import React, { useEffect, useRef } from 'react';
import type { MoveRecord } from '@/types/chess';
import { Button } from '@/components/ui/Button';
import { CornerDownLeft } from 'lucide-react';

interface MoveHistoryProps {
  moves: MoveRecord[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  isLiveGame: boolean;
  onReturnToLive: () => void;
}

export function MoveHistory({
  moves,
  currentIndex,
  onNavigate,
  isLiveGame,
  onReturnToLive,
}: MoveHistoryProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeMoveRef = useRef<HTMLButtonElement>(null);

  // Group moves into turns (white move + black move)
  const turns = React.useMemo(() => {
    const list: { moveNumber: number; white?: MoveRecord; black?: MoveRecord; whiteIdx?: number; blackIdx?: number }[] = [];
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      if (move.color === 'w') {
        list.push({
          moveNumber: move.moveNumber,
          white: move,
          whiteIdx: i,
        });
      } else {
        const lastTurn = list[list.length - 1];
        if (lastTurn && !lastTurn.black) {
          lastTurn.black = move;
          lastTurn.blackIdx = i;
        } else {
          list.push({
            moveNumber: move.moveNumber,
            black: move,
            blackIdx: i,
          });
        }
      }
    }
    return list;
  }, [moves]);

  // Smooth scroll to active move
  useEffect(() => {
    if (activeMoveRef.current && scrollContainerRef.current) {
      activeMoveRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  return (
    <div className="flex flex-col flex-1 min-h-[160px] max-h-[320px] bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] overflow-hidden">
      {/* Move list header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]">
        <span className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--color-text-secondary)]">
          Move Ledger
        </span>
        <span className="text-[11px] font-mono text-[var(--color-text-tertiary)]">
          {moves.length} {moves.length === 1 ? 'ply' : 'plies'}
        </span>
      </div>

      {/* Review mode banner */}
      {!isLiveGame && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#261d12] border-b border-[#5e3c1a] text-xs text-[var(--color-accent-bright)]">
          <span className="font-mono text-[11px]">Reviewing position</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReturnToLive}
            className="h-6 px-2 text-[11px] text-[var(--color-accent-bright)] hover:text-white"
            icon={<CornerDownLeft className="w-3 h-3" />}
          >
            Live Game
          </Button>
        </div>
      )}

      {/* Moves scroll area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto divide-y divide-[var(--color-border-subtle)] p-1 font-mono text-xs"
      >
        {turns.length === 0 ? (
          <div className="flex items-center justify-center h-28 text-[var(--color-text-tertiary)] text-xs italic font-sans">
            No moves recorded yet
          </div>
        ) : (
          turns.map((turn) => {
            const isWhiteActive = turn.whiteIdx === currentIndex;
            const isBlackActive = turn.blackIdx === currentIndex;

            return (
              <div
                key={turn.moveNumber}
                className="grid grid-cols-[40px_1fr_1fr] items-center h-8 hover:bg-[var(--color-surface-raised)] transition-colors px-1"
              >
                {/* Turn number */}
                <span className="text-[var(--color-text-tertiary)] pl-1 select-none">
                  {turn.moveNumber}.
                </span>

                {/* White move */}
                {turn.white ? (
                  <button
                    ref={isWhiteActive ? activeMoveRef : null}
                    onClick={() => turn.whiteIdx !== undefined && onNavigate(turn.whiteIdx)}
                    className={`h-7 px-2 text-left rounded-[2px] transition-all cursor-pointer flex items-center justify-between ${
                      isWhiteActive
                        ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent-bright)] font-semibold border-l-2 border-[var(--color-accent)]'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)]'
                    }`}
                  >
                    <span>{turn.white.san}</span>
                  </button>
                ) : (
                  <span />
                )}

                {/* Black move */}
                {turn.black ? (
                  <button
                    ref={isBlackActive ? activeMoveRef : null}
                    onClick={() => turn.blackIdx !== undefined && onNavigate(turn.blackIdx)}
                    className={`h-7 px-2 text-left rounded-[2px] transition-all cursor-pointer flex items-center justify-between ${
                      isBlackActive
                        ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent-bright)] font-semibold border-l-2 border-[var(--color-accent)]'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)]'
                    }`}
                  >
                    <span>{turn.black.san}</span>
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MoveHistory;
