import React, { useState } from 'react';
import {
  RotateCcw,
  RotateCw,
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
  onRedo: () => void;
  onFlipBoard: () => void;
  onCopyFEN: () => Promise<boolean>;
  onImportFEN: (fen: string) => boolean;
  onResign: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isGameOver: boolean;
  isThinking: boolean;
}

export function GameControls({
  onNewGame,
  onUndo,
  onRedo,
  onFlipBoard,
  onCopyFEN,
  onImportFEN,
  onResign,
  canUndo,
  canRedo,
  isGameOver,
  isThinking,
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

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fenInput.trim()) return;

    const ok = onImportFEN(fenInput.trim());
    if (ok) {
      setShowImportModal(false);
      setFenInput('');
      setImportError(null);
    } else {
      setImportError('Invalid FEN format or illegal board position');
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
      {/* Primary navigation toolbar */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          <IconButton
            size="md"
            label="Undo move"
            onClick={onUndo}
            disabled={!canUndo || isThinking}
          >
            <RotateCcw className="w-4 h-4" />
          </IconButton>

          <IconButton
            size="md"
            label="Redo move"
            onClick={onRedo}
            disabled={!canRedo || isThinking}
          >
            <RotateCw className="w-4 h-4" />
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
            disabled={isThinking}
          >
            <FileUp className="w-4 h-4" />
          </IconButton>

          {!showResignConfirm ? (
            <IconButton
              size="md"
              variant="danger"
              label="Resign game"
              onClick={() => setShowResignConfirm(true)}
              disabled={isGameOver || isThinking}
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

      {/* Start new game button */}
      <Button
        variant="primary"
        size="md"
        className="w-full mt-1"
        icon={<PlusCircle className="w-4 h-4" />}
        onClick={onNewGame}
      >
        New Game
      </Button>

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
                <span className="text-xs text-[#f85149] font-mono">
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
                <Button type="submit" variant="primary" size="md">
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
