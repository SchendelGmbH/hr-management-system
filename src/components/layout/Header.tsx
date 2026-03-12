'use client';

import { useSession } from 'next-auth/react';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center space-x-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
      </div>

      <div className="flex items-center space-x-4">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationsDropdown />

        {/* Language Switcher */}
        <div className="flex items-center space-x-2 rounded-lg border border-gray-300 px-3 py-1.5 dark:border-gray-600 dark:bg-gray-700">
          <button className="text-sm font-medium text-primary-600 dark:text-primary-400">DE</button>
          <span className="text-gray-300 dark:text-gray-500">|</span>
          <button className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">EN</button>
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-3 rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600 dark:bg-gray-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white">
            <span className="text-sm font-medium">
              {session?.user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{session?.user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
