import React from 'react';
import type { MoveRecord, GameOutcome } from '@/types/chess';
import type { EngineStatus as EngineStatusType } from '@/types/engine';
import { EngineStatus } from './EngineStatus';
import { MoveHistory } from './MoveHistory';
import { GameControls } from './GameControls';

interface GamePanelProps {
  engineStatus: EngineStatusType;
  lastResponse: {
    time: number | null;
    depth: number | null;
    nodes: number | null;
    score: number | null;
    mateIn: number | null;
  } | null;
  moves: MoveRecord[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  isLiveGame: boolean;
  onReturnToLive: () => void;
  onNewGame: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFlipBoard: () => void;
  onCopyFEN: () => Promise<boolean>;
  onImportFEN: (fen: string) => boolean;
  onResign: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isGameOver: boolean;
}

export function GamePanel({
  engineStatus,
  lastResponse,
  moves,
  currentIndex,
  onNavigate,
  isLiveGame,
  onReturnToLive,
  onNewGame,
  onUndo,
  onRedo,
  onFlipBoard,
  onCopyFEN,
  onImportFEN,
  onResign,
  canUndo,
  canRedo,
  isGameOver,
}: GamePanelProps) {
  return (
    <div className="flex flex-col gap-3 w-full lg:w-[320px] shrink-0">
      {/* Engine Status / Thinking indicator */}
      <EngineStatus status={engineStatus} lastResponse={lastResponse} />

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
        onRedo={onRedo}
        onFlipBoard={onFlipBoard}
        onCopyFEN={onCopyFEN}
        onImportFEN={onImportFEN}
        onResign={onResign}
        canUndo={canUndo}
        canRedo={canRedo}
        isGameOver={isGameOver}
        isThinking={engineStatus.thinking}
      />
    </div>
  );
}

export default GamePanel;
