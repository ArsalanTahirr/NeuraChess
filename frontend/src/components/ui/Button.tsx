import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      icon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

    const sizeStyles = {
      sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-[var(--radius-sm)]',
      md: 'h-9 px-4 text-sm gap-2 rounded-[var(--radius-sm)]',
      lg: 'h-11 px-5 text-base gap-2.5 rounded-[var(--radius-sm)]',
    }[size];

    const variantStyles = {
      primary:
        'bg-[var(--color-accent)] text-[#0e0d0b] hover:bg-[var(--color-accent-bright)] active:bg-[var(--color-accent-dim)] font-semibold shadow-sm',
      secondary:
        'bg-[var(--color-surface-panel)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-raised)]',
      ghost:
        'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]',
      danger:
        'bg-[#2d1210] text-[#e06c75] border border-[#5c2420] hover:bg-[#3d1a16] hover:border-[#7c302a]',
    }[variant];

    return (
      <motion.button
        ref={ref}
        whileTap={!disabled && !isLoading ? { scale: 0.97 } : undefined}
        transition={{ duration: 0.05 }}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon
        )}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
