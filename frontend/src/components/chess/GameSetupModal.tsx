import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { PlayerColor } from '@/types/chess';
import { Button } from '@/components/ui/Button';

interface GameSetupModalProps {
  isOpen: boolean;
  onStartGame: (color: PlayerColor, depth: number) => void;
  onClose?: () => void;
  initialColor?: PlayerColor;
  initialDepth?: number;
}

export function GameSetupModal({
  isOpen,
  onStartGame,
  onClose,
  initialColor = 'white',
  initialDepth = 4,
}: GameSetupModalProps) {
  const [selectedColor, setSelectedColor] = useState<PlayerColor>(initialColor);
  const [depth, setDepth] = useState<number>(initialDepth);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(14,13,11,0.85)] backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md p-6 bg-[var(--color-surface-panel)] border border-[var(--color-border-emphasis)] rounded-[var(--radius-lg)] shadow-2xl relative flex flex-col items-center text-center"
        >
          {/* Header & Brand */}
          <div className="flex flex-col items-center gap-1.5 mb-5">
            <span className="font-display italic text-3xl font-medium tracking-wide text-[var(--color-text-primary)]">
              NeuraChess
            </span>
            <span className="text-xs tracking-wider uppercase text-[var(--color-text-tertiary)] font-mono">
              The Intelligence Atelier
            </span>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xs">
              Classical strategy reinforced with deep neural position assessment.
            </p>
          </div>

          {/* Color Selection Cards */}
          <div className="w-full mb-6">
            <span className="block text-xs font-mono font-medium tracking-wider uppercase text-[var(--color-text-secondary)] mb-3 text-left">
              1. Choose Your Side
            </span>

            <div className="grid grid-cols-2 gap-3">
              {/* White Card */}
              <button
                type="button"
                onClick={() => setSelectedColor('white')}
                className={`flex flex-col items-center justify-center p-4 rounded-[var(--radius-md)] border cursor-pointer transition-all ${
                  selectedColor === 'white'
                    ? 'bg-[var(--color-accent-glow)] border-[var(--color-accent)] shadow-[0_0_12px_rgba(184,115,51,0.25)]'
                    : 'bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-muted)]'
                }`}
              >
                <span className="text-4xl mb-1 text-[#f0ece4] select-none">♔</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  White
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono mt-0.5">
                  Moves First
                </span>
              </button>

              {/* Black Card */}
              <button
                type="button"
                onClick={() => setSelectedColor('black')}
                className={`flex flex-col items-center justify-center p-4 rounded-[var(--radius-md)] border cursor-pointer transition-all ${
                  selectedColor === 'black'
                    ? 'bg-[var(--color-accent-glow)] border-[var(--color-accent)] shadow-[0_0_12px_rgba(184,115,51,0.25)]'
                    : 'bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-muted)]'
                }`}
              >
                <span className="text-4xl mb-1 text-[#d4924a] select-none">♚</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Black
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono mt-0.5">
                  Engine Moves First
                </span>
              </button>
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="w-full mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-medium tracking-wider uppercase text-[var(--color-text-secondary)]">
                2. Calculation Depth
              </span>
              <span className="text-xs font-mono text-[var(--color-accent-bright)]">
                Depth {depth}
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={6}
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full h-1.5 bg-[var(--color-surface-base)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
            />
            <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-tertiary)] mt-1">
              <span>Rapid (1)</span>
              <span>Standard (4)</span>
              <span>Deep (6)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col w-full gap-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => onStartGame(selectedColor, depth)}
            >
              Begin Match
            </Button>

            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-[var(--color-text-tertiary)]"
              >
                Dismiss
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default GameSetupModal;
