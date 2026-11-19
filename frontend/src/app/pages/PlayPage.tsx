import React, { useState, useMemo } from 'react';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { EvaluationBar } from '@/components/chess/EvaluationBar';
import { PlayerInfo } from '@/components/chess/PlayerInfo';
import { GamePanel } from '@/components/chess/GamePanel';
import { GameSetupModal } from '@/components/chess/GameSetupModal';
import { GameOverOverlay } from '@/components/chess/GameOverOverlay';
import { useGameState } from '@/features/game/useGameState';
import { useSettings } from '@/features/settings/settingsContext';
import { createAdapter } from '@/api';
import { calculateMaterialAdvantage } from '@/lib/chessUtils';
import type { PlayerColor } from '@/types/chess';

export function PlayPage() {
  const { settings } = useSettings();
  const [playerColor, setPlayerColor] = useState<PlayerColor>(settings.defaultPlayerColor);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [showGameOverReview, setShowGameOverReview] = useState<boolean>(true);

  // Initialize engine adapter once
  const adapter = useMemo(() => createAdapter(), []);

  // Central chess state
  const {
    fen,
    turn,
    isCheck,
    isGameOver,
    kingSquare,
    outcome,
    moveHistory,
    currentMoveIndex,
    lastMove,
    capturedPieces,
    isBoardFlipped,
    isLiveGame,
    engineStatus,
    lastEngineResponse,
    actions,
  } = useGameState(adapter, playerColor);

  // Material calculation
  const materialAdvantage = useMemo(
    () => calculateMaterialAdvantage(capturedPieces),
    [capturedPieces]
  );

  const handleStartGame = (color: PlayerColor, depth: number) => {
    setPlayerColor(color);
    setShowSetupModal(false);
    setShowGameOverReview(true);
    actions.newGame();
  };

  // Players definition based on color & orientation
  const isPlayerWhite = playerColor === 'white';
  const isEngineTurn = turn !== (isPlayerWhite ? 'w' : 'b');

  // Top player is the opponent / engine (unless flipped)
  const topColor: PlayerColor = isBoardFlipped ? playerColor : isPlayerWhite ? 'black' : 'white';
  const bottomColor: PlayerColor = isBoardFlipped ? (isPlayerWhite ? 'black' : 'white') : playerColor;

  const isTopActive = topColor === 'white' ? turn === 'w' : turn === 'b';
  const isBottomActive = bottomColor === 'white' ? turn === 'w' : turn === 'b';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Main Game Arena */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 w-full">
        {/* Evaluation Bar (Desktop) */}
        <div className="hidden lg:flex items-center pt-10">
          <EvaluationBar
            score={lastEngineResponse?.score ?? null}
            mateIn={lastEngineResponse?.mateIn ?? null}
            orientation={isBoardFlipped ? 'black' : 'white'}
            height={480}
          />
        </div>

        {/* Board Column (Centerpiece) */}
        <div className="flex flex-col items-center w-full max-w-[620px]">
          {/* Top Player Info */}
          <div className="w-full mb-1">
            <PlayerInfo
              side="top"
              color={topColor}
              name={topColor === playerColor ? 'You' : 'NeuraChess AI'}
              isEngine={topColor !== playerColor}
              isActive={isTopActive && !isGameOver}
              capturedPieces={
                topColor === 'white' ? capturedPieces.white : capturedPieces.black
              }
              materialAdvantage={
                topColor === 'white' ? materialAdvantage.white : materialAdvantage.black
              }
            />
          </div>

          {/* Interactive Chessboard */}
          <div className="w-full flex items-center justify-center">
            <ChessBoard
              position={fen}
              orientation={isBoardFlipped ? 'black' : 'white'}
              onMove={actions.makeMove}
              lastMove={lastMove}
              isCheck={isCheck}
              kingSquare={kingSquare}
              isGameOver={isGameOver}
              isThinking={engineStatus.thinking}
              playerColor={playerColor}
              showCoordinates={settings.showCoordinates}
              showLegalMoves={settings.showLegalMoves}
              showLastMove={settings.showLastMove}
              boardTheme={settings.boardTheme}
              animatePieces={settings.animatePieces && !settings.reducedMotion}
              isLiveGame={isLiveGame}
            />
          </div>

          {/* Bottom Player Info */}
          <div className="w-full mt-1">
            <PlayerInfo
              side="bottom"
              color={bottomColor}
              name={bottomColor === playerColor ? 'You' : 'NeuraChess AI'}
              isEngine={bottomColor !== playerColor}
              isActive={isBottomActive && !isGameOver}
              capturedPieces={
                bottomColor === 'white' ? capturedPieces.white : capturedPieces.black
              }
              materialAdvantage={
                bottomColor === 'white' ? materialAdvantage.white : materialAdvantage.black
              }
            />
          </div>
        </div>

        {/* Right Intelligence & Progression Panel */}
        <div className="w-full lg:w-[320px] mt-2 lg:mt-0">
          <GamePanel
            engineStatus={engineStatus}
            lastResponse={lastEngineResponse}
            moves={moveHistory}
            currentIndex={currentMoveIndex}
            onNavigate={actions.navigateTo}
            isLiveGame={isLiveGame}
            onReturnToLive={actions.returnToLive}
            onNewGame={() => setShowSetupModal(true)}
            onUndo={actions.undoMove}
            onRedo={actions.redoMove}
            onFlipBoard={actions.flipBoard}
            onCopyFEN={actions.copyFEN}
            onImportFEN={actions.importFEN}
            onResign={actions.resign}
            canUndo={moveHistory.length > 0 && isLiveGame}
            canRedo={currentMoveIndex < moveHistory.length - 1}
            isGameOver={isGameOver}
          />
        </div>
      </div>

      {/* Game Setup Modal */}
      <GameSetupModal
        isOpen={showSetupModal}
        initialColor={playerColor}
        initialDepth={settings.engineDepth}
        onStartGame={handleStartGame}
        onClose={() => setShowSetupModal(false)}
      />

      {/* Game Over Outcome Modal */}
      {outcome && showGameOverReview && (
        <GameOverOverlay
          outcome={outcome}
          onNewGame={() => {
            setShowGameOverReview(false);
            setShowSetupModal(true);
          }}
          onDismiss={() => setShowGameOverReview(false)}
        />
      )}
    </div>
  );
}

export default PlayPage;
