import React from 'react';
import { motion } from 'motion/react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  label?: string;
}

export function Switch({ checked, onChange, id, disabled = false, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-[var(--color-border-subtle)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'bg-[var(--color-accent)] border-[var(--color-accent-bright)]' : 'bg-[var(--color-surface-panel)]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`pointer-events-none block h-3.5 w-3.5 rounded-full shadow-sm mt-[2px] ${
          checked ? 'bg-[#0e0d0b] ml-[18px]' : 'bg-[var(--color-text-secondary)] ml-[2px]'
        }`}
      />
    </button>
  );
}
