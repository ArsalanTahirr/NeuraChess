import React from 'react';
import { motion } from 'motion/react';
import type { ConnectionStatus as Connection } from '@/types/engine';

type Page = 'play' | 'analysis' | 'about' | 'settings';

interface AppShellProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
  connection: Connection;
}

const NAV_TABS: { id: Page; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'about', label: 'About' },
  { id: 'settings', label: 'Settings' },
];

function KnightIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M7 20 L7 8 C7 6.5 8 5.5 9 5 C10 4.5 11 4 12 3 C13 4 13.5 5 14 6.5 C13 7 12 7.5 11.5 8.5 L15 8.5 C16 8.5 17 9.5 17 10.5 L17 20"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="6.5" r="0.75" fill="var(--color-accent)" />
      <line
        x1="7"
        y1="17"
        x2="17"
        y2="17"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ConnectionStatus({ mode }: { mode: Connection }) {
  const dotColor =
    mode === 'connected'
      ? '#4ade80'
      : mode === 'offline'
      ? '#ef4444'
      : '#b87333';

  const label = mode === 'connected' ? 'ENGINE' : mode === 'offline' ? 'OFFLINE' : 'CONNECTING';

  return (
    <div className="flex items-center gap-1.5 shrink-0" role="status" aria-label={label}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: dotColor,
          display: 'inline-block',
          boxShadow: `0 0 6px ${dotColor}60`,
        }}
      />
      <span
        className="hidden sm:inline"
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function AppShell({ currentPage, onNavigate, children, connection }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-surface-base)] text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 flex items-center justify-between px-3 sm:px-6 bg-[var(--color-surface-base)]/95 backdrop-blur-md border-b border-[var(--color-border-subtle)]">
        {/* Left: Wordmark */}
        <div className="flex items-center gap-2 sm:gap-2.5 sm:min-w-[160px]">
          <KnightIcon />
          <span className="font-display italic font-medium text-lg sm:text-xl text-[var(--color-text-primary)] tracking-wide select-none">
            NeuraChess
          </span>
        </div>

        {/* Center: Navigation tabs */}
        <nav
          className="flex-1 flex justify-center items-center px-1 sm:px-4"
          aria-label="Main navigation"
        >
          <div className="flex items-center gap-0.5 sm:gap-2">
            {NAV_TABS.map((tab) => {
              const isActive = currentPage === tab.id;
              return (
                <button
                  key={tab.id}
                  data-nav={tab.id}
                  onClick={() => onNavigate(tab.id)}
                  className={`relative px-2 sm:px-4 h-14 flex flex-col items-center justify-center bg-transparent border-none cursor-pointer font-sans font-medium text-xs sm:text-sm tracking-wider uppercase transition-colors select-none ${
                    isActive
                      ? 'text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="pb-1">{tab.label}</span>
                  {/* Sliding underline indicator */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-tab-indicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] bg-[var(--color-accent)] rounded-t-sm w-[calc(100%-8px)]"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right: Connection status */}
        <div className="flex items-center justify-end sm:min-w-[160px]">
          <ConnectionStatus mode={connection} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
