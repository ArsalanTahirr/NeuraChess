import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { EvaluationBar } from '@/components/chess/EvaluationBar';
import { PlayerInfo } from '@/components/chess/PlayerInfo';
import { GamePanel } from '@/components/chess/GamePanel';
import { GameSetupModal } from '@/components/chess/GameSetupModal';
import { GameOverOverlay } from '@/components/chess/GameOverOverlay';
import type { useGameState } from '@/features/game/useGameState';
import { useSettings } from '@/features/settings/settingsContext';
import type { PlayerColor } from '@/types/chess';
import type { ConnectionStatus, EvaluationMode } from '@/types/engine';

interface PlayPageProps {
  game: ReturnType<typeof useGameState>;
  connection: ConnectionStatus;
}

export function PlayPage({ game, connection }: PlayPageProps) {
  const { settings } = useSettings();
  const [manualSetup, setManualSetup] = useState(false);
  const [dismissedSetup, setDismissedSetup] = useState(false);
  const [dismissedOutcome, setDismissedOutcome] = useState<typeof game.outcome>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const {
    fen, turn, isCheck, isGameOver, kingSquare, outcome, moveHistory, currentMoveIndex,
    lastMove, capturedPieces, materialAdvantage, playerColor, orientation, isLiveGame,
    lastSearch, evaluationMode, busy, thinking, error, canMove, canUndo, canRetry, actions,
    hasGame, pendingRestore, restoreError,
  } = game;

  const showSetupModal = manualSetup || (!hasGame && !pendingRestore && !dismissedSetup);

  const openSetup = () => {
    setSetupError(null);
    setManualSetup(true);
  };

  const handleStartGame = async (color: PlayerColor, depth: number, mode: EvaluationMode) => {
    setSetupError(null);
    try {
      await actions.newGame({
        playerColor: color,
        maxDepth: depth,
        evaluationMode: mode,
        timeLimitMs: settings.engineTimeLimit,
      });
      setManualSetup(false);
      setDismissedOutcome(null);
    } catch (cause) {
      setSetupError((cause as Error).message);
    }
  };

  const bottomColor = orientation;
  const topColor = orientation === 'white' ? 'black' : 'white';

  const isTopActive = topColor === 'white' ? turn === 'w' : turn === 'b';
  const isBottomActive = bottomColor === 'white' ? turn === 'w' : turn === 'b';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 lg:p-6 max-w-7xl mx-auto w-full">
      {/* Main Game Arena */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 w-full">
        {/* Evaluation Bar (Desktop) */}
        <div className="hidden shrink-0 lg:flex items-center pt-10">
          <EvaluationBar
            score={lastSearch?.scoreCp ?? null}
            mate={lastSearch?.mate ?? null}
            orientation={orientation}
            height={480}
          />
        </div>

        {/* Board Column (Centerpiece) */}
        <div className="flex min-w-0 flex-col items-center w-full max-w-[620px]">
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
              orientation={orientation}
              onMove={actions.makeMove}
              lastMove={lastMove}
              isCheck={isCheck}
              kingSquare={kingSquare}
              isGameOver={isGameOver}
              isThinking={thinking || busy}
              playerColor={playerColor}
              showCoordinates={settings.showCoordinates}
              showLegalMoves={settings.showLegalMoves}
              showLastMove={settings.showLastMove}
              boardTheme={settings.boardTheme}
              animatePieces={settings.animatePieces && !settings.reducedMotion}
              isLiveGame={isLiveGame && canMove}
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
        <div className="w-full lg:w-[320px] lg:shrink-0 mt-2 lg:mt-0">
          {pendingRestore && (
            <div className="flex items-center justify-between gap-2 pb-3 text-sm">
              <p role="status">{restoreError ?? (connection === 'offline'
                ? 'Waiting for the server to resume your match.'
                : 'Resuming your match…')}</p>
              {restoreError && <Button size="sm" onClick={actions.retryRestore}>Retry</Button>}
            </div>
          )}
          <GamePanel
            connection={connection}
            evaluationMode={evaluationMode}
            thinking={thinking}
            busy={busy || pendingRestore}
            error={error}
            onRetry={canRetry ? actions.retryEngine : undefined}
            lastResponse={lastSearch}
            moves={moveHistory}
            currentIndex={currentMoveIndex}
            onNavigate={actions.navigateTo}
            isLiveGame={isLiveGame}
            onReturnToLive={actions.returnToLive}
            onNewGame={openSetup}
            onUndo={actions.undoMove}
            onPrevious={() => actions.navigateTo(currentMoveIndex - 1)}
            onNext={() => actions.navigateTo(currentMoveIndex + 1)}
            onFlipBoard={actions.flipBoard}
            onCopyFEN={actions.copyFEN}
            onImportFEN={actions.importFEN}
            onResign={actions.resign}
            canUndo={canUndo}
            canPrevious={currentMoveIndex >= 0}
            canNext={currentMoveIndex < moveHistory.length - 1}
            isGameOver={isGameOver}
          />
        </div>
      </div>

      {/* Game Setup Modal */}
      {showSetupModal && <GameSetupModal
        initialColor={playerColor}
        initialDepth={settings.engineDepth}
        busy={busy}
        error={setupError ?? (!hasGame && !pendingRestore ? error : null)}
        onStartGame={handleStartGame}
        onClose={() => {
          setManualSetup(false);
          setDismissedSetup(true);
        }}
      />}

      {/* Game Over Outcome Modal */}
      {outcome && outcome !== dismissedOutcome && !showSetupModal && (
        <GameOverOverlay
          outcome={outcome}
          onNewGame={() => {
            setDismissedOutcome(outcome);
            openSetup();
          }}
          onDismiss={() => setDismissedOutcome(outcome)}
        />
      )}
    </div>
  );
}

export default PlayPage;
