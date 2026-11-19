import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { validateFen } from '@/lib/chessUtils';
import { Check, Copy } from 'lucide-react';

interface FenInputProps {
  currentFen: string;
  onApplyFen: (fen: string) => boolean;
}

export function FenInput({ currentFen, onApplyFen }: FenInputProps) {
  const [value, setValue] = useState(currentFen);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setValue(currentFen);
    setError(null);
  }, [currentFen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    const val = validateFen(trimmed);
    if (!val.valid) {
      setError(val.error || 'Invalid FEN format');
      return;
    }

    const success = onApplyFen(trimmed);
    if (!success) {
      setError('Illegal board position');
    } else {
      setError(null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFen);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
      <div className="flex items-center justify-between">
        <label
          htmlFor="fen-input"
          className="text-xs font-mono font-medium tracking-wider uppercase text-[var(--color-text-secondary)]"
        >
          Forsyth–Edwards Notation
        </label>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#7ee787]" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="fen-input"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          className="flex-1 h-9 px-3 font-mono text-xs bg-[var(--color-surface-base)] border border-[var(--color-border-muted)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)]"
          placeholder="Paste FEN here..."
        />
        <Button type="submit" variant="primary" size="md">
          Load
        </Button>
      </form>

      {error && (
        <span className="text-xs font-mono text-[#f85149]">
          {error}
        </span>
      )}
    </div>
  );
}

export default FenInput;
