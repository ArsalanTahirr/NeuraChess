import React from 'react';

interface SeparatorProps {
  label?: string;
  className?: string;
}

export function Separator({ label, className = '' }: SeparatorProps) {
  if (label) {
    return (
      <div className={`relative flex items-center justify-center my-4 ${className}`}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-border-subtle)]" />
        </div>
        <span className="relative px-3 bg-[var(--color-surface-base)] text-[11px] font-mono tracking-wider text-[var(--color-text-tertiary)] uppercase">
          {label}
        </span>
      </div>
    );
  }

  return (
    <hr className={`border-t border-[var(--color-border-subtle)] my-2 ${className}`} />
  );
}
