import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PromotionDialogProps {
  color: 'w' | 'b';
  square: string;
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

const PIECES: { piece: 'q' | 'r' | 'b' | 'n'; label: string; symbol: string }[] = [
  { piece: 'q', label: 'Queen',  symbol: '♛' },
  { piece: 'r', label: 'Rook',   symbol: '♜' },
  { piece: 'b', label: 'Bishop', symbol: '♝' },
  { piece: 'n', label: 'Knight', symbol: '♞' },
];

// White pieces use the filled (outline) symbols
const WHITE_PIECES: { piece: 'q' | 'r' | 'b' | 'n'; label: string; symbol: string }[] = [
  { piece: 'q', label: 'Queen',  symbol: '♛' },
  { piece: 'r', label: 'Rook',   symbol: '♜' },
  { piece: 'b', label: 'Bishop', symbol: '♝' },
  { piece: 'n', label: 'Knight', symbol: '♞' },
];

const AUTO_SELECT_MS = 15_000;

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export const PromotionDialog: React.FC<PromotionDialogProps> = ({
  color,
  square,
  onSelect,
  onCancel,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-select queen after timeout
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onSelect('q');
    }, AUTO_SELECT_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onSelect]);

  // Escape key → cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const pieces = color === 'w' ? WHITE_PIECES : PIECES;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="promotion-dialog-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(14,13,11,0.72)',
          backdropFilter: 'blur(2px)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
        }}
      >
        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: -8 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 320, damping: 24, mass: 0.8 }
          }
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-surface-overlay, #242018)',
            border: '1px solid var(--color-border-emphasis, #504840)',
            borderRadius: 10,
            padding: '20px 16px 16px',
            boxShadow:
              '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(184,115,51,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            minWidth: 300,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-text-tertiary, #605848)',
              fontFamily: 'monospace',
              marginBottom: 2,
            }}
          >
            Promote Pawn
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {pieces.map(({ piece, label, symbol }, i) => (
              <PromotionPieceButton
                key={piece}
                piece={piece}
                label={label}
                symbol={symbol}
                color={color}
                index={i}
                onClick={() => onSelect(piece)}
              />
            ))}
          </div>

          <button
            onClick={onCancel}
            style={{
              marginTop: 2,
              background: 'none',
              border: 'none',
              color: 'var(--color-text-tertiary, #605848)',
              fontSize: 11,
              cursor: 'pointer',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
              padding: '4px 8px',
              borderRadius: 4,
              transition: 'color 0.12s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-secondary, #9a9080)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-tertiary, #605848)';
            }}
          >
            Cancel (Esc)
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

interface PromotionPieceButtonProps {
  piece: 'q' | 'r' | 'b' | 'n';
  label: string;
  symbol: string;
  color: 'w' | 'b';
  index: number;
  onClick: () => void;
}

const PromotionPieceButton: React.FC<PromotionPieceButtonProps> = ({
  piece,
  label,
  symbol,
  color,
  index,
  onClick,
}) => {
  const isWhite = color === 'w';

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { delay: index * 0.055, type: 'spring', stiffness: 300, damping: 22 }
      }
      whileHover={prefersReducedMotion ? {} : { scale: 1.08, y: -2 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
      onClick={onClick}
      title={label}
      style={{
        width: 64,
        height: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: 'var(--color-surface-panel, #1c1a17)',
        border: '1px solid var(--color-border-muted, #3a342c)',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'border-color 0.12s, background 0.12s',
        color: isWhite ? '#f0ece4' : '#0e0d0b',
        fontSize: 36,
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = 'var(--color-accent, #b87333)';
        btn.style.background = 'var(--color-accent-glow, rgba(184,115,51,0.15))';
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = 'var(--color-border-muted, #3a342c)';
        btn.style.background = 'var(--color-surface-panel, #1c1a17)';
      }}
    >
      <span
        style={{
          textShadow: isWhite
            ? '0 1px 3px rgba(0,0,0,0.5)'
            : '0 1px 2px rgba(255,255,255,0.1)',
          filter: isWhite ? 'drop-shadow(0 0 6px rgba(240,236,228,0.4))' : 'none',
        }}
      >
        {symbol}
      </span>
      <span
        style={{
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary, #605848)',
          fontFamily: 'monospace',
        }}
      >
        {label}
      </span>
    </motion.button>
  );
};

export default PromotionDialog;
