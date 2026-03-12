'use client';

import { cn } from '@/lib/utils';
import { SelectHTMLAttributes, forwardRef } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-lg',
          'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
