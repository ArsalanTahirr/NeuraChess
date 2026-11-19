import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <select
        className={`h-9 px-3 bg-[var(--color-surface-panel)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] text-sm focus:outline-none focus:border-[var(--color-accent)] cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
