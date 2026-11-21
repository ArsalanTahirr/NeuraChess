import React from 'react';
import { useSettings } from '@/features/settings/settingsContext';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import type { BoardTheme, PlayerColor } from '@/types/chess';
import { RotateCcw } from 'lucide-react';

const BOARD_THEMES: { id: BoardTheme; name: string; light: string; dark: string }[] = [
  { id: 'classic', name: 'Classic Wood', light: '#e8d5b0', dark: '#8b6914' },
  { id: 'lichess', name: 'Warm Brown', light: '#f0d9b5', dark: '#b58863' },
  { id: 'midnight', name: 'Midnight Charcoal', light: '#c8b89a', dark: '#4a3c28' },
  { id: 'slate', name: 'Atelier Slate', light: '#cad2c5', dark: '#445b41' },
];

export function SettingsPage({ onTestMoveSounds, soundError }: { onTestMoveSounds: () => void; soundError: string | null }) {
  const { settings, updateSetting, resetSettings } = useSettings();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-[var(--color-border-subtle)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Preferences & Settings
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Configure visual presentation, board rules, and engine calculation limits.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetSettings}
          icon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Reset Defaults
        </Button>
      </div>

      <div className="space-y-8">
        {/* Section 1: Board Appearance */}
        <div>
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--color-accent-bright)] mb-4">
            Board Aesthetics
          </h2>

          <div className="space-y-4">
            {/* Board Theme Selector */}
            <div>
              <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Board Surface Theme
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {BOARD_THEMES.map((theme) => {
                  const isSelected = settings.boardTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => updateSetting('boardTheme', theme.id)}
                      className={`flex flex-col items-center p-3 rounded-[var(--radius-sm)] border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[var(--color-accent-glow)] border-[var(--color-accent)] shadow-sm'
                          : 'bg-[var(--color-surface-panel)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-muted)]'
                      }`}
                    >
                      {/* Mini 2x2 board preview */}
                      <div className="w-10 h-10 grid grid-cols-2 grid-rows-2 rounded overflow-hidden shadow-inner mb-2 border border-black/20">
                        <div style={{ backgroundColor: theme.light }} />
                        <div style={{ backgroundColor: theme.dark }} />
                        <div style={{ backgroundColor: theme.dark }} />
                        <div style={{ backgroundColor: theme.light }} />
                      </div>
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Coordinates Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Show Board Coordinates
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Renders rank (1–8) and file (a–h) labels along the chessboard edges.
                </span>
              </div>
              <Switch
                checked={settings.showCoordinates}
                onChange={(checked) => updateSetting('showCoordinates', checked)}
              />
            </div>

            {/* Legal Move Indicators Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Highlight Legal Moves
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Displays indicators on empty target squares and rings on capture squares.
                </span>
              </div>
              <Switch
                checked={settings.showLegalMoves}
                onChange={(checked) => updateSetting('showLegalMoves', checked)}
              />
            </div>

            {/* Last Move Highlighting Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Highlight Last Move
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Highlights the origin and destination squares of the previous move.
                </span>
              </div>
              <Switch
                checked={settings.showLastMove}
                onChange={(checked) => updateSetting('showLastMove', checked)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Motion & Interaction */}
        <div>
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--color-accent-bright)] mb-4">
            Motion & Sound
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Animate Piece Slides
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Smooth 160ms interpolation when pieces glide across squares.
                </span>
              </div>
              <Switch
                checked={settings.animatePieces}
                onChange={(checked) => updateSetting('animatePieces', checked)}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Reduced Motion Mode
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Disables thinking node pulses, modal transitions, and sliding effects.
                </span>
              </div>
              <Switch
                checked={settings.reducedMotion}
                onChange={(checked) => updateSetting('reducedMotion', checked)}
              />
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <label htmlFor="move-sounds" className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Move Sounds
                </label>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Play a sound when either side moves or captures a piece.
                </span>
              </div>
              <Switch
                id="move-sounds"
                label="Move Sounds"
                checked={settings.soundEnabled}
                onChange={(checked) => {
                  if (checked) onTestMoveSounds();
                  updateSetting('soundEnabled', checked);
                }}
              />
            </div>
            {settings.soundEnabled && (
              <div className="flex flex-col items-start gap-2">
                <Button size="sm" onClick={onTestMoveSounds}>Test sound</Button>
                {soundError && <p role="alert" className="text-xs text-[#f85149]">{soundError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Engine Configuration */}
        <div>
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--color-accent-bright)] mb-4">
            Engine Search Parameters
          </h2>

          <div className="space-y-4">
            {/* Search Depth */}
            <div className="p-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Default Calculation Depth
                </span>
                <span className="text-xs font-mono font-semibold text-[var(--color-accent-bright)]">
                  Ply {settings.engineDepth}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                value={settings.engineDepth}
                onChange={(e) => updateSetting('engineDepth', Number(e.target.value))}
                className="w-full h-1.5 bg-[var(--color-surface-base)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
              />
              <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-tertiary)] mt-1">
                <span>Depth 1 (Rapid)</span>
                <span>Depth 4 (Standard)</span>
                <span>Depth 6 (Deep)</span>
              </div>
            </div>

            {/* Time limit */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Search Time Allocation
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Maximum time budgeted for iterative deepening search per move.
                </span>
              </div>
              <select
                value={settings.engineTimeLimit}
                onChange={(e) => updateSetting('engineTimeLimit', Number(e.target.value))}
                className="h-9 px-3 bg-[var(--color-surface-panel)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] text-xs font-mono focus:outline-none focus:border-[var(--color-accent)] cursor-pointer"
              >
                <option value={500}>500 ms (Blitz)</option>
                <option value={1200}>1.2 s (Rapid)</option>
                <option value={2000}>2.0 s (Balanced)</option>
                <option value={3000}>3.0 s (Deep)</option>
                <option value={5000}>5.0 s (Maximum)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Local Storage Indicator */}
        <div className="p-3 bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] text-xs font-mono text-[var(--color-text-tertiary)] text-center">
          ✓ All preferences persist automatically in your browser's local storage.
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
