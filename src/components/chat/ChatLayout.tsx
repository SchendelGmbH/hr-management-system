'use client';

import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface ChatLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  className?: string;
}

export function ChatLayout({ children, sidebar, className }: ChatLayoutProps) {
  return (
    <div className={clsx(
      'flex h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden',
      className
    )}>
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-80 border-r border-gray-200 flex-shrink-0">
        {sidebar}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
