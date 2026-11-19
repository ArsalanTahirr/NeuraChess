import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { GameOutcome } from '@/types/chess';
import { Button } from '@/components/ui/Button';
import { Trophy, RefreshCw, Eye } from 'lucide-react';

interface GameOverOverlayProps {
  outcome: GameOutcome;
  onNewGame: () => void;
  onDismiss: () => void;
}

export function GameOverOverlay({ outcome, onNewGame, onDismiss }: GameOverOverlayProps) {
  const getOutcomeTitle = () => {
    switch (outcome.reason) {
      case 'checkmate':
        return 'Checkmate';
      case 'stalemate':
        return 'Stalemate';
      case 'resignation':
        return 'Resignation';
      case 'threefold-repetition':
        return 'Threefold Repetition';
      case 'insufficient-material':
        return 'Insufficient Material';
      case 'fifty-move':
        return 'Fifty-Move Rule';
      default:
        return 'Game Over';
    }
  };

  const getWinnerDescription = () => {
    if (outcome.result === 'draw') return 'The match concluded in a draw.';
    if (outcome.winner === 'white') return 'White claims victory.';
    if (outcome.winner === 'black') return 'Black claims victory.';
    return '';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[rgba(14,13,11,0.78)] backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 12 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="w-full max-w-sm p-6 bg-[var(--color-surface-panel)] border border-[var(--color-border-emphasis)] rounded-[var(--radius-lg)] shadow-2xl text-center flex flex-col items-center"
        >
          {/* Trophy / Result Icon */}
          <div className="w-12 h-12 mb-3 rounded-full bg-[var(--color-accent-glow)] border border-[var(--color-accent)] flex items-center justify-center text-[var(--color-accent-bright)]">
            <Trophy className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)] mb-1">
            {getOutcomeTitle()}
          </h2>

          <p className="text-sm font-medium text-[var(--color-accent-bright)] mb-1">
            {getWinnerDescription()}
          </p>

          <p className="text-xs text-[var(--color-text-tertiary)] font-mono mb-6">
            Termination: {outcome.reason.replace('-', ' ')}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              icon={<Eye className="w-4 h-4" />}
              onClick={onDismiss}
            >
              Review Board
            </Button>

            <Button
              variant="primary"
              size="md"
              className="flex-1"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={onNewGame}
            >
              Play Again
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default GameOverOverlay;
