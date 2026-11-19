import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ThinkingIndicatorProps {
  isThinking: boolean;
}

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

// Node layout for a 5-node branching search tree
// Root → two children, left child → two grandchildren
//
//        [0]
//       /   \
//     [1]   [2]
//    /   \
//  [3]   [4]
//
const NODES = [
  { id: 0, cx: 60, cy: 10 },   // root
  { id: 1, cx: 30, cy: 32 },   // left child
  { id: 2, cx: 90, cy: 32 },   // right child
  { id: 3, cx: 14, cy: 54 },   // left grandchild
  { id: 4, cx: 46, cy: 54 },   // right grandchild
];

const EDGES = [
  { from: 0, to: 1 },
  { from: 0, to: 2 },
  { from: 1, to: 3 },
  { from: 1, to: 4 },
];

// Pulse sequence order (left-to-right search exploration)
const PULSE_ORDER = [0, 1, 3, 4, 2];

function getNodeById(id: number) {
  return NODES.find((n) => n.id === id)!;
}

const NodeGraph: React.FC<{ isThinking: boolean }> = ({ isThinking }) => {
  return (
    <svg
      width={120}
      height={62}
      viewBox="0 0 120 62"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Edges */}
      {EDGES.map(({ from, to }, edgeIdx) => {
        const a = getNodeById(from);
        const b = getNodeById(to);
        return (
          <motion.line
            key={`edge-${from}-${to}`}
            x1={a.cx}
            y1={a.cy}
            x2={b.cx}
            y2={b.cy}
            stroke="var(--color-accent-dim, #7a4d22)"
            strokeWidth={1.2}
            animate={
              isThinking && !prefersReducedMotion
                ? {
                    opacity: [0.2, 0.75, 0.2],
                    strokeWidth: [1, 1.8, 1],
                  }
                : { opacity: 0.18, strokeWidth: 1 }
            }
            transition={
              isThinking && !prefersReducedMotion
                ? {
                    duration: 2.4,
                    delay: edgeIdx * 0.35,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
                : { duration: 0.3 }
            }
          />
        );
      })}

      {/* Nodes */}
      {NODES.map((node, i) => {
        const pulseIdx = PULSE_ORDER.indexOf(node.id);
        return (
          <motion.circle
            key={`node-${node.id}`}
            cx={node.cx}
            cy={node.cy}
            r={5.5}
            fill="var(--color-surface-panel, #1c1a17)"
            stroke={
              node.id === 0
                ? 'var(--color-accent, #b87333)'
                : 'var(--color-accent-dim, #7a4d22)'
            }
            strokeWidth={1.4}
            animate={
              isThinking && !prefersReducedMotion
                ? {
                    r: [5.5, 7.5, 5.5],
                    opacity: [0.55, 1, 0.55],
                    stroke:
                      node.id === 0
                        ? ['#b87333', '#d4924a', '#b87333']
                        : ['#7a4d22', '#b87333', '#7a4d22'],
                  }
                : { r: 5.5, opacity: 0.4, stroke: 'var(--color-accent-dim, #7a4d22)' }
            }
            transition={
              isThinking && !prefersReducedMotion
                ? {
                    duration: 1.8,
                    delay: pulseIdx * 0.28,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
                : { duration: 0.3 }
            }
          />
        );
      })}
    </svg>
  );
};

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  isThinking,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: 120,
        minHeight: 60,
      }}
    >
      <NodeGraph isThinking={isThinking} />

      <AnimatePresence mode="wait">
        {isThinking ? (
          <motion.div
            key="thinking"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <ThinkingDots />
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--color-accent, #b87333)',
                fontFamily: 'monospace',
              }}
            >
              Thinking
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            style={{
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--color-text-tertiary, #605848)',
              fontFamily: 'monospace',
            }}
          >
            ◆ READY
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Three animated dots for the "thinking" label */
const ThinkingDots: React.FC = () => {
  if (prefersReducedMotion) {
    return <span style={{ color: 'var(--color-accent, #b87333)', fontSize: 9 }}>···</span>;
  }
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            display: 'inline-block',
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'var(--color-accent, #b87333)',
          }}
          animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
          transition={{
            duration: 1.2,
            delay: i * 0.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
};

export default ThinkingIndicator;
