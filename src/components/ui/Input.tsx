'use client';

import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-lg',
          'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'placeholder:text-gray-400',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
