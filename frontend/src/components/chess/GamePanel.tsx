import React from 'react';
import type { MoveRecord } from '@/types/chess';
import type { ConnectionStatus, EvaluationMode, SearchResult } from '@/types/engine';
import { EngineStatus } from './EngineStatus';
import { MoveHistory } from './MoveHistory';
import { GameControls } from './GameControls';

interface GamePanelProps {
  connection: ConnectionStatus;
  evaluationMode: EvaluationMode | null;
  thinking: boolean;
  busy: boolean;
  error: string | null;
  onRetry?: () => void;
  lastResponse: SearchResult | null;
  moves: MoveRecord[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  isLiveGame: boolean;
  onReturnToLive: () => void;
  onNewGame: () => void;
  onUndo: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onFlipBoard: () => void;
  onCopyFEN: () => Promise<boolean>;
  onImportFEN: (fen: string) => Promise<void>;
  onResign: () => void;
  canUndo: boolean;
  canPrevious: boolean;
  canNext: boolean;
  isGameOver: boolean;
}

export function GamePanel({
  connection,
  evaluationMode,
  thinking,
  busy,
  error,
  onRetry,
  lastResponse,
  moves,
  currentIndex,
  onNavigate,
  isLiveGame,
  onReturnToLive,
  onNewGame,
  onUndo,
  onPrevious,
  onNext,
  onFlipBoard,
  onCopyFEN,
  onImportFEN,
  onResign,
  canUndo,
  canPrevious,
  canNext,
  isGameOver,
}: GamePanelProps) {
  return (
    <div className="flex flex-col gap-3 w-full lg:w-[320px] shrink-0">
      {/* Engine Status / Thinking indicator */}
      <EngineStatus
        connection={connection}
        mode={evaluationMode}
        thinking={thinking}
        error={error}
        onRetry={onRetry}
        lastResponse={lastResponse}
      />

      {/* Move ledger */}
      <MoveHistory
        moves={moves}
        currentIndex={currentIndex}
        onNavigate={onNavigate}
        isLiveGame={isLiveGame}
        onReturnToLive={onReturnToLive}
      />

      {/* Game controls */}
      <GameControls
        onNewGame={onNewGame}
        onUndo={onUndo}
        onPrevious={onPrevious}
        onNext={onNext}
        onFlipBoard={onFlipBoard}
        onCopyFEN={onCopyFEN}
        onImportFEN={onImportFEN}
        onResign={onResign}
        canUndo={canUndo}
        canPrevious={canPrevious}
        canNext={canNext}
        isGameOver={isGameOver}
        busy={busy}
      />
    </div>
  );
}

export default GamePanel;
