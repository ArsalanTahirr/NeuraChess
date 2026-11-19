import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  const sizeStyles = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  const variantStyles = {
    default: 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]',
    accent: 'bg-[var(--color-accent-glow)] text-[var(--color-accent-bright)] border border-[var(--color-accent-dim)]',
    success: 'bg-[#18311a] text-[#7ee787] border border-[#2b5930]',
    warning: 'bg-[#33220f] text-[#d4924a] border border-[#6b4217]',
    error: 'bg-[#2b1212] text-[#f85149] border border-[#662020]',
    outline: 'bg-transparent text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)]',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium tracking-wide uppercase rounded-[var(--radius-sm)] ${sizeStyles} ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
}
