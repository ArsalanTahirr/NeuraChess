import React from 'react';
import { Separator } from '@/components/ui/Separator';
import { GitBranch, Brain, Database, Cpu, Layers } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-10 max-w-4xl mx-auto w-full">
      {/* Hero Editorial Header */}
      <div className="flex flex-col gap-3 mb-10 text-center items-center">
        <span className="text-xs font-mono tracking-widest uppercase text-[var(--color-accent-bright)]">
          Architectural Brief
        </span>
        <h1 className="font-display italic text-4xl sm:text-5xl font-medium tracking-tight text-[var(--color-text-primary)]">
          The Engineering of NeuraChess
        </h1>
        <p className="text-base sm:text-lg text-[var(--color-text-secondary)] max-w-2xl font-light leading-relaxed">
          How classical alpha-beta tree search collaborates with a custom 773-input PyTorch neural network to evaluate chess positions with strategic depth.
        </p>
      </div>

      <Separator className="my-8" />

      {/* Section 01: Core Architecture */}
      <section className="mb-12">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-sm text-[var(--color-accent)] font-semibold">01</span>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            System Overview & Foundation
          </h2>
        </div>
        <div className="space-y-4 text-[var(--color-text-secondary)] leading-relaxed text-sm sm:text-base">
          <p>
            NeuraChess is structured as a dual-engine architecture. At the core, <code className="text-[var(--color-text-primary)] font-mono text-xs px-1.5 py-0.5 bg-[var(--color-surface-panel)] rounded">python-chess</code> provides precise rule validation, move generation, and bitboard primitives. Over this foundation, a high-performance search algorithm navigates candidate game trees while a specialized neural network provides leaf evaluation.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
            <div className="p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] flex flex-col gap-1.5">
              <span className="font-mono text-xs text-[var(--color-accent-bright)] uppercase">Layer I</span>
              <strong className="text-[var(--color-text-primary)] text-sm">Rules & Representation</strong>
              <span className="text-xs text-[var(--color-text-tertiary)]">Bitboards, legal move generation, castling, en passant, and draw rules.</span>
            </div>
            <div className="p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] flex flex-col gap-1.5">
              <span className="font-mono text-xs text-[var(--color-accent-bright)] uppercase">Layer II</span>
              <strong className="text-[var(--color-text-primary)] text-sm">Pruned Tree Search</strong>
              <span className="text-xs text-[var(--color-text-tertiary)]">Iterative deepening, alpha-beta cutoffs, quiescence search, and transposition tables.</span>
            </div>
            <div className="p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] flex flex-col gap-1.5">
              <span className="font-mono text-xs text-[var(--color-accent-bright)] uppercase">Layer III</span>
              <strong className="text-[var(--color-text-primary)] text-sm">Neural Evaluator</strong>
              <span className="text-xs text-[var(--color-text-tertiary)]">773-dimensional board vector mapped through trained PyTorch MLPs to centipawn score.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 02: Classical Search Algorithms */}
      <section className="mb-12">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-sm text-[var(--color-accent)] font-semibold">02</span>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            Search Pipeline & Tree Pruning
          </h2>
        </div>
        <div className="space-y-4 text-[var(--color-text-secondary)] leading-relaxed text-sm sm:text-base">
          <p>
            Raw minimax search explores an exponential branching factor of approximately 35 moves per position. NeuraChess deploys several classical pruning and ordering enhancements to compress the search space by orders of magnitude:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-1">
            <li>
              <strong className="text-[var(--color-text-primary)]">Negamax with Alpha-Beta Pruning:</strong> Expresses game trees symmetrically from the perspective of the mover, pruning subtrees whenever <code className="text-xs font-mono text-[var(--color-accent-bright)]">α ≥ β</code>.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Move Ordering:</strong> Moves are sorted before recursion to test high-probability winning captures first (Most Valuable Victim – Least Valuable Aggressor heuristic), maximizing early cutoffs.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Quiescence Search:</strong> When search reaches depth 0, tactical volatility is resolved by examining captures exclusively until a quiet, non-tactical position is reached, eliminating the destructive "horizon effect".
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Transposition Tables:</strong> Previously computed subtrees are cached with depth and bound flags (Exact, Lowerbound, Upperbound) using canonical position keys, avoiding redundant evaluations in transposed lines.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Timed Iterative Deepening:</strong> Deepens search from depth 1 upwards under strict wall-clock deadlines, ensuring the best move from the last fully completed ply is returned even on search timeouts.
            </li>
          </ul>

          {/* Visual Search Tree Diagram */}
          <div className="my-6 p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] flex flex-col items-center">
            <span className="text-xs font-mono text-[var(--color-text-tertiary)] uppercase mb-3">
              Alpha-Beta Pruning Visualization
            </span>
            <svg width="340" height="150" viewBox="0 0 340 150" className="overflow-visible">
              {/* Root */}
              <circle cx="170" cy="20" r="12" fill="var(--color-surface-raised)" stroke="var(--color-accent)" strokeWidth="2" />
              <text x="170" y="24" textAnchor="middle" fill="#f0ece4" fontSize="10" fontFamily="monospace">Root</text>

              {/* Depth 1 Edges */}
              <line x1="170" y1="32" x2="90" y2="70" stroke="var(--color-accent-dim)" strokeWidth="1.5" />
              <line x1="170" y1="32" x2="250" y2="70" stroke="var(--color-accent-dim)" strokeWidth="1.5" />

              {/* Depth 1 Nodes */}
              <circle cx="90" cy="70" r="10" fill="var(--color-surface-panel)" stroke="var(--color-accent)" strokeWidth="1.5" />
              <text x="90" y="74" textAnchor="middle" fill="#f0ece4" fontSize="9" fontFamily="monospace">+1.2</text>

              <circle cx="250" cy="70" r="10" fill="var(--color-surface-panel)" stroke="var(--color-border-emphasis)" strokeWidth="1.5" />
              <text x="250" y="74" textAnchor="middle" fill="#9a9080" fontSize="9" fontFamily="monospace">≤0.4</text>

              {/* Depth 2 Edges Left */}
              <line x1="90" y1="80" x2="50" y2="120" stroke="var(--color-border-muted)" strokeWidth="1.2" />
              <line x1="90" y1="80" x2="130" y2="120" stroke="var(--color-border-muted)" strokeWidth="1.2" />

              {/* Depth 2 Edges Right (Pruned) */}
              <line x1="250" y1="80" x2="210" y2="120" stroke="var(--color-border-muted)" strokeWidth="1.2" />
              <line x1="250" y1="80" x2="290" y2="120" stroke="#7a3028" strokeWidth="1.5" strokeDasharray="3 3" />

              {/* Depth 2 Nodes */}
              <circle cx="50" cy="120" r="8" fill="var(--color-surface-raised)" stroke="var(--color-border-emphasis)" strokeWidth="1" />
              <circle cx="130" cy="120" r="8" fill="var(--color-surface-raised)" stroke="var(--color-border-emphasis)" strokeWidth="1" />

              <circle cx="210" cy="120" r="8" fill="var(--color-surface-raised)" stroke="var(--color-border-emphasis)" strokeWidth="1" />
              {/* Pruned node with X */}
              <circle cx="290" cy="120" r="8" fill="#2d1210" stroke="#8b3a2a" strokeWidth="1" />
              <text x="290" y="123" textAnchor="middle" fill="#e06c75" fontSize="10" fontFamily="monospace">✕</text>
            </svg>
            <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] mt-2">
              Branch at node (right) is safely cut off when beta threshold is exceeded.
            </span>
          </div>
        </div>
      </section>

      {/* Section 03: PyTorch Neural Evaluator */}
      <section className="mb-12">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-sm text-[var(--color-accent)] font-semibold">03</span>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            PyTorch Neural Evaluation Model
          </h2>
        </div>
        <div className="space-y-4 text-[var(--color-text-secondary)] leading-relaxed text-sm sm:text-base">
          <p>
            Rather than relying solely on simplistic material piece counting (pawn=100, knight=320, rook=500), the project features <code className="text-xs font-mono text-[var(--color-accent-bright)]">ChessEvaluator</code>: a custom PyTorch deep learning architecture that assesses positional nuance, king safety, piece square mobility, and pawn structure.
          </p>

          <div className="p-4 bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] font-mono text-xs space-y-2">
            <div className="text-[var(--color-accent-bright)]">// Neural Architecture (ChessEvaluator)</div>
            <div>Input Dimension: <strong className="text-[var(--color-text-primary)]">773 features</strong> (64 squares × 12 piece types + castling/turn/en-passant context)</div>
            <div>Hidden Layer 1: <strong className="text-[var(--color-text-primary)]">Linear(773 → 256)</strong> + LayerNorm + ReLU + Dropout(0.1)</div>
            <div>Hidden Layer 2: <strong className="text-[var(--color-text-primary)]">Linear(256 → 128)</strong> + LayerNorm + ReLU</div>
            <div>Output Layer: <strong className="text-[var(--color-text-primary)]">Linear(128 → 1)</strong> (Continuous centipawn score prediction)</div>
            <div>Loss Objective: <strong className="text-[var(--color-text-primary)]">Smooth L1 / Huber Loss</strong> (Robust against outlier tactical spikes)</div>
          </div>
        </div>
      </section>

      {/* Section 04: Training Dataset */}
      <section className="mb-12">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-sm text-[var(--color-accent)] font-semibold">04</span>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            Stratified Training Dataset Pipeline
          </h2>
        </div>
        <div className="space-y-4 text-[var(--color-text-secondary)] leading-relaxed text-sm sm:text-base">
          <p>
            The training pipeline builds on over 8 million source evaluations from Lichess Cloud Evaluations. A specialized pipeline (<code className="text-xs font-mono text-[var(--color-text-primary)]">scripts/build_dataset.py</code>) samples 1,000,000 unique positions adhering to strict quality controls:
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-1 text-sm">
            <li>Minimum Stockfish search depth of 16 to guarantee label authority.</li>
            <li>Symmetric clipping of centipawn scores within [-1500, +1500].</li>
            <li>15-stratum sampling balanced across evaluation categories (Strong Black, Moderate Black, Equal, Moderate White, Strong White) and game phases (Opening, Middlegame, Endgame).</li>
            <li>Zero-tolerance for duplicate positions via canonical FEN board hashing.</li>
          </ul>
        </div>
      </section>

      {/* Footer Notice */}
      <div className="p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] text-xs text-[var(--color-text-tertiary)] flex items-center justify-between">
        <span>NeuraChess Frontend v0.1.0 • Built with React, Vite & TypeScript</span>
        <span className="font-mono">feat/react-frontend</span>
      </div>
    </div>
  );
}

export default AboutPage;
