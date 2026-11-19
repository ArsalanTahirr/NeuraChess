import React, { useState, useMemo, useCallback } from 'react';
import { Chess, type Square } from 'chess.js';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { EvaluationBar } from '@/components/chess/EvaluationBar';
import { FenInput } from '@/components/analysis/FenInput';
import { PositionPresets, type PresetPosition, NOTABLE_PRESETS } from '@/components/analysis/PositionPresets';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/features/settings/settingsContext';
import { createAdapter } from '@/api';
import { ArrowLeftRight, RotateCcw, Copy } from 'lucide-react';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function AnalysisPage() {
  const { settings } = useSettings();
  const [fen, setFen] = useState<string>(START_FEN);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Engine adapter
  const adapter = useMemo(() => createAdapter(), []);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess(START_FEN);
    }
  }, [fen]);

  const turn = chess.turn();
  const isCheck = chess.inCheck();
  const isGameOver = chess.isGameOver();

  // Find king square if in check
  const kingSquare = useMemo(() => {
    if (!isCheck) return null;
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          return p.square as Square;
        }
      }
    }
    return null;
  }, [chess, isCheck, turn]);

  // Handle move on analysis board
  const handleMove = useCallback(
    (from: Square, to: Square, promotion: string = 'q'): boolean => {
      try {
        const c = new Chess(fen);
        const move = c.move({ from, to, promotion });
        if (move) {
          setFen(c.fen());
          setLastMove({ from, to });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fen]
  );

  const handleApplyFen = (newFen: string): boolean => {
    try {
      const c = new Chess(newFen);
      setFen(c.fen());
      setLastMove(null);
      return true;
    } catch {
      return false;
    }
  };

  const handleSelectPreset = (preset: PresetPosition) => {
    handleApplyFen(preset.fen);
  };

  const handleReset = () => {
    handleApplyFen(START_FEN);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 lg:p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 w-full">
        {/* Evaluation Bar */}
        <div className="hidden lg:flex items-center pt-10">
          <EvaluationBar
            score={null}
            mateIn={null}
            orientation={orientation}
            height={480}
          />
        </div>

        {/* Board Centerpiece */}
        <div className="flex flex-col items-center w-full max-w-[600px]">
          {/* Quick Toolbar */}
          <div className="w-full flex items-center justify-between pb-2 mb-1 border-b border-[var(--color-border-subtle)]">
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">
              Turn: <strong className="text-[var(--color-text-primary)]">{turn === 'w' ? 'White' : 'Black'}</strong>
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
                icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
              >
                Flip
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Board */}
          <div className="w-full flex items-center justify-center">
            <ChessBoard
              position={fen}
              orientation={orientation}
              onMove={handleMove}
              lastMove={lastMove}
              isCheck={isCheck}
              kingSquare={kingSquare}
              isGameOver={isGameOver}
              isThinking={false}
              playerColor={turn === 'w' ? 'white' : 'black'}
              showCoordinates={settings.showCoordinates}
              showLegalMoves={settings.showLegalMoves}
              showLastMove={settings.showLastMove}
              boardTheme={settings.boardTheme}
              animatePieces={settings.animatePieces && !settings.reducedMotion}
              isLiveGame={true}
            />
          </div>
        </div>

        {/* Right Inspection & FEN Tools */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4">
          <AnalysisPanel
            result={null}
            isAnalyzing={false}
            isDemoMode={true}
          />

          <FenInput
            currentFen={fen}
            onApplyFen={handleApplyFen}
          />

          <PositionPresets
            onSelect={handleSelectPreset}
            currentFen={fen}
          />
        </div>
      </div>
    </div>
  );
}

export default AnalysisPage;
