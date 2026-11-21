import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { MateScore } from '@/types/engine';
import { formatEvaluation } from '@/lib/chessUtils';

interface EvaluationBarProps {
  score: number | null;      // centipawns from white's perspective
  mate: MateScore | null;
  orientation: 'white' | 'black';
  height?: number;
}

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/** Map a centipawn score to a 0–1 fraction (white's portion of the bar) */
function scoreToFraction(score: number): number {
  // Sigmoid-like mapping: ±500cp → ±80% of the bar
  // f(x) = 0.5 + 0.5 * tanh(x / 650)
  const clamped = Math.max(-2000, Math.min(2000, score));
  const t = clamped / 650;
  const tanh = (Math.exp(t) - Math.exp(-t)) / (Math.exp(t) + Math.exp(-t));
  return 0.5 + 0.5 * tanh;
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({
  score,
  mate,
  orientation,
  height = 400,
}) => {
  const whiteFraction = useMemo(() => {
    if (mate !== null) {
      return mate.winner === 'white' ? 1 : 0;
    }
    if (score === null) return 0.5;
    return scoreToFraction(score);
  }, [score, mate]);

  // If orientation is 'black', flip: white is at top, black at bottom;
  // when orientation is 'white', white is at bottom
  const whiteIsBottom = orientation === 'white';

  // The white segment height %
  const whiteHeight = `${whiteFraction * 100}%`;
  const blackHeight = `${(1 - whiteFraction) * 100}%`;

  const evaluation = formatEvaluation(score, mate);
  const scoreLabel = mate ? `M${mate.plies}` : evaluation;

  // Label goes on the winning side edge
  const whiteAdvantage = mate !== null ? mate.winner === 'white' : (score ?? 0) >= 0;
  const labelOnTop = whiteIsBottom ? !whiteAdvantage : whiteAdvantage;

  const springTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        type: 'spring' as const,
        stiffness: 100,
        damping: 20,
        mass: 1,
      };

  return (
    <div
      title={evaluation}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        width: 36,
        height: height + 24,
      }}
    >
      {/* Top label */}
      <div
        style={{
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {labelOnTop && (
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              letterSpacing: '0.04em',
              color: whiteAdvantage
                ? 'var(--color-text-primary, #f0ece4)'
                : 'var(--color-text-secondary, #9a9080)',
              lineHeight: 1,
            }}
          >
            {scoreLabel}
          </span>
        )}
      </div>

      {/* Bar */}
      <div
        style={{
          width: 12,
          height: height,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--color-surface-inset, #0a0908)',
          border: '1px solid var(--color-border-subtle, #2a2620)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {whiteIsBottom ? (
          <>
            {/* Black segment at top */}
            <motion.div
              style={{
                background: '#1a1814',
                width: '100%',
              }}
              animate={{ height: blackHeight }}
              transition={springTransition}
            />
            {/* White segment at bottom */}
            <motion.div
              style={{
                background: 'linear-gradient(180deg, #c8b89a 0%, #e8d5b0 100%)',
                width: '100%',
              }}
              animate={{ height: whiteHeight }}
              transition={springTransition}
            />
          </>
        ) : (
          <>
            {/* White segment at top */}
            <motion.div
              style={{
                background: 'linear-gradient(180deg, #e8d5b0 0%, #c8b89a 100%)',
                width: '100%',
              }}
              animate={{ height: whiteHeight }}
              transition={springTransition}
            />
            {/* Black segment at bottom */}
            <motion.div
              style={{
                background: '#1a1814',
                width: '100%',
              }}
              animate={{ height: blackHeight }}
              transition={springTransition}
            />
          </>
        )}

        {/* Center tick */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            background: 'var(--color-border-subtle, #2a2620)',
            transform: 'translateY(-0.5px)',
          }}
        />
      </div>

      {/* Bottom label */}
      <div
        style={{
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!labelOnTop && (
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              letterSpacing: '0.04em',
              color: whiteAdvantage
                ? 'var(--color-text-primary, #f0ece4)'
                : 'var(--color-text-secondary, #9a9080)',
              lineHeight: 1,
            }}
          >
            {scoreLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default EvaluationBar;
