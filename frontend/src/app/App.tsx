import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageTransition } from '@/components/layout/PageTransition';
import { PlayPage } from '@/app/pages/PlayPage';
import { AnalysisPage } from '@/app/pages/AnalysisPage';
import { AboutPage } from '@/app/pages/AboutPage';
import { SettingsPage } from '@/app/pages/SettingsPage';
import { backend } from '@/api/backendAdapter';
import { useMoveSound } from '@/features/game/useMoveSound';
import { useGameState } from '@/features/game/useGameState';
import type { ConnectionStatus } from '@/types/engine';
import { useSettings } from '@/features/settings/settingsContext';

type Page = 'play' | 'analysis' | 'about' | 'settings';

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('play');
  const { settings } = useSettings();
  const [connection, setConnection] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const check = async () => {
      try {
        await backend.health(controller.signal);
        if (!controller.signal.aborted) setConnection('connected');
      } catch {
        if (!controller.signal.aborted) setConnection('offline');
      }
    };
    void check();
    const interval = window.setInterval(check, 10_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const moveSound = useMoveSound(settings.soundEnabled);
  const game = useGameState(settings.defaultPlayerColor, connection, moveSound.play);

  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage} connection={connection}>
      <PageTransition pageKey={currentPage}>
        {currentPage === 'play' && <PlayPage game={game} connection={connection} />}
        {currentPage === 'analysis' && <AnalysisPage playSound={moveSound.play} />}
        {currentPage === 'about' && <AboutPage />}
        {currentPage === 'settings' && <SettingsPage onTestMoveSounds={moveSound.preview} soundError={moveSound.error} />}
      </PageTransition>
    </AppShell>
  );
}

export default App;
