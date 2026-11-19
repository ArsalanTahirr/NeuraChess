import React from 'react';
import { SettingsProvider } from '@/features/settings/settingsContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}
