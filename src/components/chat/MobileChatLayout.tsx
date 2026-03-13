'use client';

import { ReactNode, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { ChatRoom as ChatRoomType } from '@/types/chat';
import { ChatSidebar } from './ChatSidebar';
import { BottomNavigation } from './BottomNavigation';
import { MobileRoomList } from './MobileRoomList';
import { ArrowLeft } from 'lucide-react';

interface MobileChatLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  rooms: ChatRoomType[];
  currentRoom: ChatRoomType | null;
  onSelectRoom: (room: ChatRoomType) => void;
  onCreateDirectChat?: (userId: string) => void;
  loading?: boolean;
  className?: string;
}

export type MobileView = 'list' | 'chat' | 'profile';

export function MobileChatLayout({
  children,
  sidebar,
  rooms,
  currentRoom,
  onSelectRoom,
  onCreateDirectChat,
  loading = false,
  className,
}: MobileChatLayoutProps) {
  const [activeView, setActiveView] = useState<MobileView>('list');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const handleSelectRoom = useCallback((room: ChatRoomType) => {
    onSelectRoom(room);
    setActiveView('chat');
  }, [onSelectRoom]);

  const handleBackToList = useCallback(() => {
    setActiveView('list');
  }, []);

  const handleNavChange = useCallback((view: MobileView) => {
    setActiveView(view);
  }, []);

  return (
    <div 
      suppressHydrationWarning
      className={clsx(
        'flex flex-col h-full bg-white dark:bg-gray-900',
        className
      )}
    >
      {/* Mobile Header - nur auf kleinen Screens sichtbar */}
      <div 
        suppressHydrationWarning
        className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700"
      >
        {activeView === 'chat' && currentRoom ? (
          <>
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Zurück</span>
            </button>
            <h1 className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
              {currentRoom.name}
            </h1>
            <div className="w-8" /> {/* Spacer for balance */}
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeView === 'list' ? 'Chats' : 'Profil'}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="p-2 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
              >
                <span className="sr-only">Neuer Chat</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Desktop Layout */}
        <div className="hidden lg:flex h-full">
          {/* Sidebar */}
          <div className="flex flex-col w-80 border-r border-gray-200 flex-shrink-0 dark:border-gray-700">
            {sidebar}
          </div>
          
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden flex flex-col h-full">
          {/* Room List View */}
          {activeView === 'list' && (
            <MobileRoomList
              rooms={rooms}
              currentRoom={currentRoom}
              onSelectRoom={handleSelectRoom}
              onCreateDirectChat={onCreateDirectChat}
              loading={loading}
            />
          )}

          {/* Chat View */}
          {activeView === 'chat' && (
            <div className="flex-1 flex flex-col min-w-0">
              {children}
            </div>
          )}

          {/* Profile View */}
          {activeView === 'profile' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center mb-4 dark:bg-primary-900/30">
                <span className="text-2xl font-semibold text-primary-700 dark:text-primary-300">
                  U
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Profil
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">
                Profileinstellungen kommen bald...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation - nur auf Mobile */}
      <div className="lg:hidden">
        <BottomNavigation
          activeView={activeView}
          onViewChange={handleNavChange}
          unreadCount={rooms.reduce((sum, r) => sum + r.unreadCount, 0)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowMobileSidebar(false)}>
          <div 
            className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
