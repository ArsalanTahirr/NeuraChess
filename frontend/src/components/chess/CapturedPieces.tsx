import React, { useMemo } from 'react';

interface CapturedPiecesProps {
  /** FEN position string — used to derive captured pieces from material count */
  fen: string;
  /** Which side is displayed at the bottom */
  orientation: 'white' | 'black';
  /** compact: show inline; full: show stacked rows */
  variant?: 'compact' | 'full';
}

// Material values for sorting / advantage display
const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9,
};

// Unicode symbols
const WHITE_SYMBOLS: Record<string, string> = {
  p: '♙', n: '♘', b: '♗', r: '♖', q: '♕',
};
const BLACK_SYMBOLS: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
};

// Starting piece counts
const STARTING: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

function parsePieceCounts(fen: string): { white: Record<string, number>; black: Record<string, number> } {
  const boardPart = fen.split(' ')[0];
  const white: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const black: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  for (const ch of boardPart) {
    if (ch === '/') continue;
    if ('PNBRQ'.includes(ch)) white[ch.toLowerCase()]++;
    else if ('pnbrq'.includes(ch)) black[ch]++;
  }
  return { white, black };
}

function getCaptured(
  fen: string
): { capturedByWhite: Record<string, number>; capturedByBlack: Record<string, number>; advantage: number } {
  const { white, black } = parsePieceCounts(fen);

  const capturedByWhite: Record<string, number> = {}; // white captured black pieces
  const capturedByBlack: Record<string, number> = {}; // black captured white pieces

  let advantage = 0;

  for (const piece of Object.keys(STARTING)) {
    const captW = STARTING[piece] - black[piece]; // black pieces missing → captured by white
    const captB = STARTING[piece] - white[piece]; // white pieces missing → captured by black
    if (captW > 0) capturedByWhite[piece] = captW;
    if (captB > 0) capturedByBlack[piece] = captB;
    advantage += (captW - captB) * PIECE_VALUES[piece];
  }

  return { capturedByWhite, capturedByBlack, advantage };
}

function renderPieces(
  counts: Record<string, number>,
  symbols: Record<string, string>
): React.ReactNode[] {
  const order = ['q', 'r', 'b', 'n', 'p'];
  const nodes: React.ReactNode[] = [];
  for (const piece of order) {
    const count = counts[piece] ?? 0;
    for (let i = 0; i < count; i++) {
      nodes.push(
        <span
          key={`${piece}-${i}`}
          style={{
            fontSize: 16,
            lineHeight: 1,
            marginRight: piece === 'p' ? 0 : -1,
            opacity: 0.9,
          }}
        >
          {symbols[piece]}
        </span>
      );
    }
  }
  return nodes;
}

const Row: React.FC<{
  label: string;
  pieces: React.ReactNode[];
  advantage: number;
  advantageSide: boolean; // true if this row shows the advantaged side
}> = ({ label, pieces, advantage, advantageSide }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      minHeight: 22,
    }}
  >
    <span
      style={{
        fontSize: 9,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--color-text-tertiary, #605848)',
        fontFamily: 'monospace',
        width: 32,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        flex: 1,
        color: 'var(--color-text-secondary, #9a9080)',
      }}
    >
      {pieces.length > 0 ? pieces : (
        <span style={{ color: 'var(--color-text-tertiary, #605848)', fontSize: 11 }}>–</span>
      )}
    </div>
    {advantageSide && advantage > 0 && (
      <span
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: 'var(--color-accent, #b87333)',
          letterSpacing: '0.04em',
          marginLeft: 2,
        }}
      >
        +{advantage}
      </span>
    )}
  </div>
);

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({
  fen,
  orientation,
}) => {
  const { capturedByWhite, capturedByBlack, advantage } = useMemo(
    () => getCaptured(fen),
    [fen]
  );

  // Top row = side opposite to orientation (the opponent's captured pieces)
  // If orientation is white: top = black (what black captured), bottom = white
  const topIsBlack = orientation === 'white';

  const whiteRow = (
    <Row
      label="W"
      pieces={renderPieces(capturedByWhite, BLACK_SYMBOLS)}
      advantage={advantage}
      advantageSide={advantage > 0}
    />
  );

  const blackRow = (
    <Row
      label="B"
      pieces={renderPieces(capturedByBlack, WHITE_SYMBOLS)}
      advantage={-advantage}
      advantageSide={advantage < 0}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '6px 0',
      }}
    >
      {topIsBlack ? blackRow : whiteRow}
      {topIsBlack ? whiteRow : blackRow}
    </div>
  );
};

export default CapturedPieces;
