'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'dark:focus:ring-offset-gray-900',
          {
            'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500': variant === 'primary',
            'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600': variant === 'secondary',
            'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-700': variant === 'danger',
            'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700': variant === 'ghost',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
