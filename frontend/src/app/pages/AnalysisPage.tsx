import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { EvaluationBar } from '@/components/chess/EvaluationBar';
import { FenInput } from '@/components/analysis/FenInput';
import { PositionPresets, type PresetPosition } from '@/components/analysis/PositionPresets';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/features/settings/settingsContext';
import { backend } from '@/api/backendAdapter';
import { readSavedValue, saveValue } from '@/lib/browserStorage';
import { findKingSquare, parseUciMove } from '@/lib/chessUtils';
import type { EvaluationMode, SearchResult } from '@/types/engine';
import { ArrowLeftRight, RotateCcw } from 'lucide-react';

const ANALYSIS_FEN_KEY = 'neurachess_analysis_fen';

export function AnalysisPage({ playSound }: { playSound: (capture: boolean) => Promise<void> }) {
  const { settings } = useSettings();
  const [fen, setFen] = useState(() => {
    try {
      return new Chess(readSavedValue(ANALYSIS_FEN_KEY) ?? DEFAULT_POSITION).fen();
    } catch {
      return DEFAULT_POSITION;
    }
  });
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode>('material');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  const clearAnalysis = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setResult(null);
    setIsAnalyzing(false);
    setError(null);
  }, []);

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => saveValue(ANALYSIS_FEN_KEY, fen), [fen]);

  const bestMove = useMemo(() => result?.move ? parseUciMove(result.move) : null, [result]);
  const analysisArrows = useMemo<[Square, Square, string?][]>(() =>
    bestMove ? [[bestMove.from, bestMove.to, '#39b1a0']] : [], [bestMove]);

  const analyze = async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    try {
      const next = await backend.analyze(fen, {
        evaluationMode,
        maxDepth: settings.engineDepth,
        timeLimitMs: settings.engineTimeLimit,
      }, controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message);
    } finally {
      if (active.current === controller) {
        active.current = null;
        setIsAnalyzing(false);
      }
    }
  };

  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const isCheck = chess.inCheck();
  const isGameOver = chess.isGameOver();
  const kingSquare = isCheck ? findKingSquare(chess, turn) : null;

  // Handle move on analysis board
  const handleMove = useCallback(
    (from: Square, to: Square, promotion: string = 'q'): boolean => {
      try {
        const c = new Chess(fen);
        const move = c.move({ from, to, promotion });
        if (move) {
          clearAnalysis();
          setFen(c.fen());
          setLastMove({ from, to });
          void playSound(Boolean(move.captured));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fen, clearAnalysis, playSound]
  );

  const handleApplyFen = (newFen: string): boolean => {
    try {
      const c = new Chess(newFen);
      clearAnalysis();
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
    handleApplyFen(DEFAULT_POSITION);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 lg:p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 w-full">
        {/* Evaluation Bar */}
        <div className="hidden lg:flex items-center pt-10">
          <EvaluationBar
            score={result?.scoreCp ?? null}
            mate={result?.mate ?? null}
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
              analysisArrows={analysisArrows}
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
            result={result}
            isAnalyzing={isAnalyzing}
            error={error}
            evaluationMode={evaluationMode}
            onEvaluationMode={(mode) => {
              clearAnalysis();
              setEvaluationMode(mode);
            }}
            onAnalyze={analyze}
            onPlayBestMove={bestMove
              ? () => handleMove(bestMove.from, bestMove.to, bestMove.promotion)
              : undefined}
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
