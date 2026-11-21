import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Copy,
  Check,
  FileUp,
  Flag,
  PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';

interface GameControlsProps {
  onNewGame: () => void;
  onUndo: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onFlipBoard: () => void;
  onCopyFEN: () => Promise<boolean>;
  onImportFEN: (fen: string) => Promise<void>;
  onResign: () => void;
  canUndo: boolean;
  canPrevious: boolean;
  canNext: boolean;
  isGameOver: boolean;
  busy: boolean;
}

export function GameControls({
  onNewGame,
  onUndo,
  onPrevious,
  onNext,
  onFlipBoard,
  onCopyFEN,
  onImportFEN,
  onResign,
  canUndo,
  canPrevious,
  canNext,
  isGameOver,
  busy,
}: GameControlsProps) {
  const [copied, setCopied] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const handleCopy = async () => {
    const success = await onCopyFEN();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fenInput.trim()) return;

    try {
      await onImportFEN(fenInput.trim());
      setShowImportModal(false);
      setFenInput('');
      setImportError(null);
    } catch (error) {
      setImportError((error as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
      {/* Primary navigation toolbar */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          <IconButton
            size="md"
            label="Previous position"
            onClick={onPrevious}
            disabled={!canPrevious}
          >
            <ChevronLeft className="w-4 h-4" />
          </IconButton>

          <IconButton
            size="md"
            label="Next position"
            onClick={onNext}
            disabled={!canNext}
          >
            <ChevronRight className="w-4 h-4" />
          </IconButton>

          <IconButton
            size="md"
            label="Flip board perspective"
            onClick={onFlipBoard}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </IconButton>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            size="md"
            label={copied ? 'FEN Copied!' : 'Copy FEN'}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-4 h-4 text-[#7ee787]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </IconButton>

          <IconButton
            size="md"
            label="Import position from FEN"
            onClick={() => setShowImportModal(true)}
            disabled={busy}
          >
            <FileUp className="w-4 h-4" />
          </IconButton>

          {!showResignConfirm ? (
            <IconButton
              size="md"
              variant="danger"
              label="Resign game"
              onClick={() => setShowResignConfirm(true)}
              disabled={isGameOver || busy}
            >
              <Flag className="w-4 h-4" />
            </IconButton>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setShowResignConfirm(false);
                  onResign();
                }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowResignConfirm(false)}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <Button
          variant="secondary"
          size="md"
          onClick={onUndo}
          disabled={!canUndo || busy}
        >
          Undo move
        </Button>
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          icon={<PlusCircle className="w-4 h-4" />}
          onClick={onNewGame}
          disabled={busy}
        >
          New Game
        </Button>
      </div>

      {/* Import FEN Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(14,13,11,0.85)] backdrop-blur-xs">
          <div className="w-full max-w-md p-5 bg-[var(--color-surface-overlay)] border border-[var(--color-border-emphasis)] rounded-[var(--radius-lg)] shadow-2xl">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
              Import Position (FEN)
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Paste standard Forsyth-Edwards Notation to load an active board.
            </p>

            <form onSubmit={handleImportSubmit} className="flex flex-col gap-3">
              <input
                type="text"
                value={fenInput}
                onChange={(e) => {
                  setFenInput(e.target.value);
                  setImportError(null);
                }}
                placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                className="w-full h-10 px-3 font-mono text-xs bg-[var(--color-surface-base)] border border-[var(--color-border-muted)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)]"
                autoFocus
              />

              {importError && (
                <span role="alert" className="text-xs text-[#f85149] font-mono">
                  {importError}
                </span>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" disabled={busy}>
                  Load Board
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameControls;
