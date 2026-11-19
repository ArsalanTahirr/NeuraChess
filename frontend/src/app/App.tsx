import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageTransition } from '@/components/layout/PageTransition';
import { PlayPage } from '@/app/pages/PlayPage';
import { AnalysisPage } from '@/app/pages/AnalysisPage';
import { AboutPage } from '@/app/pages/AboutPage';
import { SettingsPage } from '@/app/pages/SettingsPage';
import { useSettings } from '@/features/settings/settingsContext';

type Page = 'play' | 'analysis' | 'about' | 'settings';

export function App() {
  const [currentPage, setCurrentPage] = useState<Page>('play');
  const { settings } = useSettings();

  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      <PageTransition pageKey={currentPage}>
        {currentPage === 'play' && <PlayPage />}
        {currentPage === 'analysis' && <AnalysisPage />}
        {currentPage === 'about' && <AboutPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </PageTransition>
    </AppShell>
  );
}

export default App;
