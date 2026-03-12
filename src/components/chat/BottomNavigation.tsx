'use client';

import { MessageCircle, User, Settings, Bell, Home } from 'lucide-react';
import { clsx } from 'clsx';
import { MobileView } from './MobileChatLayout';

interface BottomNavigationProps {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
  unreadCount?: number;
}

export function BottomNavigation({
  activeView,
  onViewChange,
  unreadCount = 0,
}: BottomNavigationProps) {
  const navItems: { id: MobileView; label: string; icon: typeof MessageCircle; badge?: number }[] = [
    { id: 'list', label: 'Chats', icon: MessageCircle, badge: unreadCount },
    { id: 'chat', label: 'Aktuell', icon: Home },
    { id: 'profile', label: 'Profil', icon: User },
  ];

  return (
    <nav className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={clsx(
                'flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-2xl transition-all duration-200',
                'active:scale-95 touch-manipulation',
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="relative">
                <Icon 
                  className={clsx(
                    'h-6 w-6 transition-all duration-200',
                    isActive && 'transform -translate-y-0.5'
                  )} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary-600 dark:bg-primary-400" />
                )}
              </div>
              <span className={clsx(
                'text-xs mt-1 font-medium transition-all duration-200',
                isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Home Indicator Spacer für iOS */}
      <div className="h-1.5 w-full bg-transparent" />
    </nav>
  );
}
