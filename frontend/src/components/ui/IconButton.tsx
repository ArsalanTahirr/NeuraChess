import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label: string; // Accessible name required
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, variant = 'secondary', size = 'md', label, className = '', disabled, ...props }, ref) => {
    const sizeStyles = {
      sm: 'w-7 h-7 text-sm rounded-[var(--radius-sm)]',
      md: 'w-9 h-9 text-base rounded-[var(--radius-sm)]',
      lg: 'w-11 h-11 text-lg rounded-[var(--radius-sm)]',
    }[size];

    const variantStyles = {
      primary:
        'bg-[var(--color-accent)] text-[#0e0d0b] hover:bg-[var(--color-accent-bright)] font-semibold',
      secondary:
        'bg-[var(--color-surface-panel)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-raised)]',
      ghost:
        'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-panel)]',
      danger:
        'bg-[#2d1210] text-[#e06c75] border border-[#5c2420] hover:bg-[#3d1a16]',
    }[variant];

    return (
      <motion.button
        ref={ref}
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        transition={{ duration: 0.05 }}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center transition-colors select-none cursor-pointer disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${sizeStyles} ${variantStyles} ${className}`}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {children}
      </motion.button>
    );
  }
);

IconButton.displayName = 'IconButton';
