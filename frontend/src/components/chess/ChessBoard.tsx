import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import type { BoardTheme, PlayerColor } from '@/types/chess';
import { PromotionDialog } from './PromotionDialog';

interface ChessBoardProps {
  position: string; // FEN
  orientation: 'white' | 'black';
  onMove: (from: Square, to: Square, promotion?: string) => boolean;
  lastMove: { from: Square; to: Square } | null;
  isCheck: boolean;
  kingSquare: Square | null;
  isGameOver: boolean;
  isThinking: boolean;
  playerColor: PlayerColor;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showLastMove: boolean;
  boardTheme: BoardTheme;
  animatePieces: boolean;
  isLiveGame?: boolean;
}

const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string }> = {
  classic: { light: '#e8d5b0', dark: '#8b6914' },
  lichess: { light: '#f0d9b5', dark: '#b58863' },
  midnight: { light: '#c8b89a', dark: '#4a3c28' },
  slate: { light: '#cad2c5', dark: '#445b41' },
};

export function ChessBoard({
  position,
  orientation,
  onMove,
  lastMove,
  isCheck,
  kingSquare,
  isGameOver,
  isThinking,
  playerColor,
  showCoordinates,
  showLegalMoves,
  showLastMove,
  boardTheme,
  animatePieces,
  isLiveGame = true,
}: ChessBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(560);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
    color: 'w' | 'b';
  } | null>(null);

  // Responsive board width calculation
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      // Maintain 1:1 aspect ratio bounded by container width and available vertical height
      const availableHeight = clientHeight > 100 ? clientHeight : window.innerHeight - 200;
      const size = Math.min(clientWidth, availableHeight, 620);
      setBoardWidth(Math.max(280, Math.floor(size)));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Compute legal moves for the selected piece
  const legalMoveSquares = useMemo(() => {
    if (!selectedSquare || !showLegalMoves || !isLiveGame || isGameOver) return [];

    try {
      const chess = new Chess(position);
      const moves = chess.moves({ square: selectedSquare, verbose: true });
      return moves.map((m) => m.to as Square);
    } catch {
      return [];
    }
  }, [position, selectedSquare, showLegalMoves, isLiveGame, isGameOver]);

  // Compute custom square styles for selection, legal moves, last move, and check
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Last move highlighting
    if (showLastMove && lastMove) {
      styles[lastMove.from] = {
        backgroundColor: 'rgba(184, 115, 51, 0.28)',
      };
      styles[lastMove.to] = {
        backgroundColor: 'rgba(184, 115, 51, 0.38)',
      };
    }

    // 2. Selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(184, 115, 51, 0.52)',
        boxShadow: 'inset 0 0 0 2px var(--color-accent-bright, #d4924a)',
      };
    }

    // 3. Legal move targets
    if (showLegalMoves && selectedSquare && legalMoveSquares.length > 0) {
      const chess = new Chess(position);
      for (const targetSquare of legalMoveSquares) {
        const pieceOnTarget = chess.get(targetSquare);
        if (pieceOnTarget) {
          // Capture target: distinctive ring
          styles[targetSquare] = {
            ...styles[targetSquare],
            background:
              'radial-gradient(circle, transparent 56%, rgba(184, 115, 51, 0.65) 58%, rgba(184, 115, 51, 0.65) 76%, transparent 78%)',
          };
        } else {
          // Empty target: centered indicator dot
          styles[targetSquare] = {
            ...styles[targetSquare],
            background:
              'radial-gradient(circle, rgba(184, 115, 51, 0.65) 24%, transparent 26%)',
          };
        }
      }
    }

    // 4. King in check: subtle crimson warning glow
    if (isCheck && kingSquare) {
      styles[kingSquare] = {
        ...styles[kingSquare],
        background:
          'radial-gradient(circle, rgba(192, 57, 43, 0.75) 0%, rgba(192, 57, 43, 0.35) 65%, transparent 100%)',
        boxShadow: 'inset 0 0 10px rgba(192, 57, 43, 0.6)',
      };
    }

    return styles;
  }, [showLastMove, lastMove, selectedSquare, showLegalMoves, legalMoveSquares, isCheck, kingSquare, position]);

  // Check if a move is a pawn promotion
  const isPromotionMove = useCallback(
    (from: Square, to: Square): boolean => {
      try {
        const chess = new Chess(position);
        const piece = chess.get(from);
        if (!piece || piece.type !== 'p') return false;

        const isWhitePromotion = piece.color === 'w' && from[1] === '7' && to[1] === '8';
        const isBlackPromotion = piece.color === 'b' && from[1] === '2' && to[1] === '1';
        return isWhitePromotion || isBlackPromotion;
      } catch {
        return false;
      }
    },
    [position]
  );

  // Handle piece drop (drag and drop)
  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (!isLiveGame || isGameOver || isThinking) return false;

      // Promotion move
      if (isPromotionMove(sourceSquare, targetSquare)) {
        const chess = new Chess(position);
        const piece = chess.get(sourceSquare);
        if (piece) {
          setPendingPromotion({
            from: sourceSquare,
            to: targetSquare,
            color: piece.color,
          });
          return true;
        }
      }

      // Standard move
      const success = onMove(sourceSquare, targetSquare, 'q');
      if (success) {
        setSelectedSquare(null);
      }
      return success;
    },
    [isLiveGame, isGameOver, isThinking, isPromotionMove, position, onMove]
  );

  // Handle click-to-move and square selection
  const onSquareClick = useCallback(
    (square: Square) => {
      if (!isLiveGame || isGameOver || isThinking) return;

      const chess = new Chess(position);
      const piece = chess.get(square);
      const playerTurnColor = playerColor === 'white' ? 'w' : 'b';

      // 1. If clicking on one of the player's own pieces, select it
      if (piece && piece.color === chess.turn() && piece.color === playerTurnColor) {
        setSelectedSquare(square);
        return;
      }

      // 2. If a piece is already selected and target is a legal move
      if (selectedSquare) {
        if (isPromotionMove(selectedSquare, square)) {
          const selectedPiece = chess.get(selectedSquare);
          if (selectedPiece) {
            setPendingPromotion({
              from: selectedSquare,
              to: square,
              color: selectedPiece.color,
            });
            return;
          }
        }

        const success = onMove(selectedSquare, square, 'q');
        setSelectedSquare(null);
        if (success) return;
      }

      // Clicked on empty square or opponent piece when nothing selected
      setSelectedSquare(null);
    },
    [isLiveGame, isGameOver, isThinking, position, playerColor, selectedSquare, isPromotionMove, onMove]
  );

  // Confirm promotion piece
  const handlePromotionSelect = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!pendingPromotion) return;
      onMove(pendingPromotion.from, pendingPromotion.to, piece);
      setPendingPromotion(null);
      setSelectedSquare(null);
    },
    [pendingPromotion, onMove]
  );

  const themeColors = BOARD_THEMES[boardTheme] || BOARD_THEMES.classic;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full p-2"
    >
      <div
        style={{
          width: boardWidth,
          height: boardWidth,
          position: 'relative',
          boxShadow: '0 12px 36px rgba(0,0,0,0.45), 0 0 0 1px var(--color-border-subtle)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <Chessboard
          position={position}
          boardOrientation={orientation}
          boardWidth={boardWidth}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={customSquareStyles}
          customDarkSquareStyle={{ backgroundColor: themeColors.dark }}
          customLightSquareStyle={{ backgroundColor: themeColors.light }}
          showBoardNotation={showCoordinates}
          animationDuration={animatePieces ? 160 : 0}
          arePiecesDraggable={isLiveGame && !isGameOver && !isThinking}
          customBoardStyle={{
            borderRadius: '3px',
          }}
        />

        {/* Promotion Dialog Overlay */}
        {pendingPromotion && (
          <PromotionDialog
            color={pendingPromotion.color}
            square={pendingPromotion.to}
            onSelect={handlePromotionSelect}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>
    </div>
  );
}

export default ChessBoard;
