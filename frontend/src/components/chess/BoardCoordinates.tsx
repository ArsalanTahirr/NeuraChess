import React from 'react';

interface BoardCoordinatesProps {
  orientation: 'white' | 'black';
  boardSize: number; // px
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * Renders rank (1-8) and file (a-h) labels around the chessboard.
 * Uses absolute positioning and must be placed inside a relative container
 * that is exactly `boardSize × boardSize` px.
 */
export const BoardCoordinates: React.FC<BoardCoordinatesProps> = ({
  orientation,
  boardSize,
}) => {
  const squareSize = boardSize / 8;

  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? [...RANKS].reverse() : RANKS;

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    fontFamily: 'monospace',
    fontSize: Math.max(9, squareSize * 0.18),
    color: 'var(--color-text-tertiary, #605848)',
    lineHeight: 1,
    pointerEvents: 'none',
    userSelect: 'none',
    fontWeight: 500,
  };

  return (
    <>
      {/* Rank labels — left edge */}
      {ranks.map((rank, i) => (
        <span
          key={`rank-${rank}`}
          style={{
            ...labelStyle,
            top: squareSize * i + squareSize * 0.08,
            left: squareSize * 0.06,
            // On dark squares the label is brighter, light squares darker —
            // alternating based on board parity
            color:
              (orientation === 'white' ? 7 - i : i) % 2 === 0
                ? 'rgba(240,236,228,0.45)'
                : 'rgba(96,88,72,0.7)',
          }}
        >
          {rank}
        </span>
      ))}

      {/* File labels — bottom edge */}
      {files.map((file, i) => (
        <span
          key={`file-${file}`}
          style={{
            ...labelStyle,
            bottom: squareSize * 0.06,
            left: squareSize * i + squareSize * 0.72,
            color:
              (orientation === 'white' ? i : 7 - i) % 2 === 0
                ? 'rgba(96,88,72,0.7)'
                : 'rgba(240,236,228,0.45)',
          }}
        >
          {file}
        </span>
      ))}
    </>
  );
};

export default BoardCoordinates;
