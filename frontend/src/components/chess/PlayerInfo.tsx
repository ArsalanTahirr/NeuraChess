import React from 'react';
import type { PlayerColor } from '@/types/chess';
import { PIECE_VALUES } from '@/lib/chessUtils';

interface PlayerInfoProps {
  side: 'top' | 'bottom';
  color: PlayerColor;
  name: string;
  isEngine?: boolean;
  isActive: boolean;
  capturedPieces: string[]; // Pieces taken by this player (opponent pieces lost)
  materialAdvantage: number;
}

const PIECE_UNICODE: Record<string, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  P: '♙',
  N: '♘',
  B: '♗',
  R: '♖',
  Q: '♕',
};

export function PlayerInfo({
  side,
  color,
  name,
  isEngine = false,
  isActive,
  capturedPieces,
  materialAdvantage,
}: PlayerInfoProps) {
  const isWhite = color === 'white';

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 transition-all rounded-[var(--radius-sm)] ${
        isActive
          ? 'bg-[var(--color-surface-panel)] border-l-2 border-l-[var(--color-accent)]'
          : 'bg-transparent border-l-2 border-l-transparent opacity-85'
      }`}
      style={{
        borderTop: side === 'bottom' ? '1px solid var(--color-border-subtle)' : undefined,
        borderBottom: side === 'top' ? '1px solid var(--color-border-subtle)' : undefined,
      }}
    >
      {/* Left: Player identity & Turn Indicator */}
      <div className="flex items-center gap-2.5">
        <div
          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
            isWhite
              ? 'bg-[#f0ece4] border-[#8b6914]'
              : 'bg-[#1c1a17] border-[#504840]'
          }`}
          title={`${color} pieces`}
        >
          {isActive && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-ping"
              style={{
                backgroundColor: isWhite ? '#b87333' : '#d4924a',
              }}
            />
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium tracking-tight text-[var(--color-text-primary)]">
              {name}
            </span>
            {isEngine && (
              <span className="px-1 py-0.2 text-[9px] font-mono tracking-wider text-[var(--color-accent-bright)] bg-[var(--color-accent-glow)] rounded-[2px] uppercase">
                AI
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Captured pieces & Material advantage */}
      <div className="flex items-center gap-2">
        <div className="flex items-center text-xs tracking-tight text-[var(--color-text-secondary)]">
          {capturedPieces.map((piece, idx) => (
            <span
              key={idx}
              className="text-sm inline-block select-none"
              style={{
                marginRight: -2,
                opacity: 0.9,
              }}
            >
              {PIECE_UNICODE[piece] || piece}
            </span>
          ))}
        </div>

        {materialAdvantage > 0 && (
          <span className="text-xs font-mono font-medium text-[var(--color-accent-bright)]">
            +{materialAdvantage}
          </span>
        )}
      </div>
    </div>
  );
}

export default PlayerInfo;
