import React from 'react';

export interface PresetPosition {
  name: string;
  fen: string;
  description: string;
}

export const NOTABLE_PRESETS: PresetPosition[] = [
  {
    name: 'Opening Array',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    description: 'Standard starting position with all pieces ready.',
  },
  {
    name: 'Ruy López',
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    description: 'White’s bishop pressures the knight that defends the e5 pawn.',
  },
  {
    name: "King's Indian",
    fen: 'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5',
    description: 'Hypermodern counter-attacking defensive structure.',
  },
  {
    name: 'Tactical Sacrifice',
    fen: 'r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6',
    description: 'In the Fried Liver Attack, White can sacrifice on f7 to fork the queen and rook.',
  },
  {
    name: 'Rook Endgame',
    fen: '4k3/8/8/8/8/8/8/4KR2 w - - 0 1',
    description: 'Basic King and Rook versus lone King endgame conversion.',
  },
];

interface PositionPresetsProps {
  onSelect: (preset: PresetPosition) => void;
  currentFen: string;
}

export function PositionPresets({ onSelect, currentFen }: PositionPresetsProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-mono font-medium tracking-wider uppercase text-[var(--color-text-secondary)]">
        Notable Positions
      </span>

      <div className="flex flex-wrap gap-1.5">
        {NOTABLE_PRESETS.map((preset) => {
          const isSelected = currentFen.trim() === preset.fen.trim();
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => onSelect(preset)}
              className={`px-2.5 py-1 text-xs rounded-[var(--radius-sm)] border font-mono transition-colors cursor-pointer select-none ${
                isSelected
                  ? 'bg-[var(--color-accent-glow)] border-[var(--color-accent)] text-[var(--color-accent-bright)] font-semibold'
                  : 'bg-[var(--color-surface-panel)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PositionPresets;
