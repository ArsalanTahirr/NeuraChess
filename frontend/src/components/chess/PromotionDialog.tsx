import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/Button';

interface PromotionDialogProps {
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

const PIECES = [
  { piece: 'q', label: 'Queen', w: '♕', b: '♛' },
  { piece: 'r', label: 'Rook', w: '♖', b: '♜' },
  { piece: 'b', label: 'Bishop', w: '♗', b: '♝' },
  { piece: 'n', label: 'Knight', w: '♘', b: '♞' },
] as const;

export function PromotionDialog({ color, onSelect, onCancel }: PromotionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => onSelect('q'), 15_000);
    return () => clearTimeout(timer);
  }, [onSelect]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[26rem] max-h-[calc(100%-2rem)] rounded-xl border border-[var(--color-border-emphasis)] bg-[var(--color-surface-overlay)] p-0 text-[var(--color-text-primary)] shadow-2xl backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-semibold">Promote pawn</h2>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PIECES.map(({ piece, label, ...symbols }) => (
            <button
              key={piece}
              type="button"
              aria-label={label}
              onClick={() => onSelect(piece)}
              className="flex min-h-22 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-raised)] p-2 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-bright)]"
            >
              <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded bg-[#e8d5b0] font-serif text-[2rem] leading-none text-[#211e1a]"
              >
                {symbols[color]}
              </span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
