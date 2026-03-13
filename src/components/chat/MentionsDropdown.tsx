'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AtSign, User } from 'lucide-react';
import { clsx } from 'clsx';

interface MentionUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'away';
}

interface MentionsDropdownProps {
  roomId: string;
  query: string;
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function MentionsDropdown({
  roomId,
  query,
  onSelect,
  onClose,
  position
}: MentionsDropdownProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch room members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/chat/rooms/${roomId}/members`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.members || []);
        }
      } catch (error) {
        console.error('Error fetching room members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [roomId]);

  // Filter users based on query
  useEffect(() => {
    const searchLower = query.toLowerCase();
    const filtered = users.filter(
      user =>
        user.name.toLowerCase().includes(searchLower) ||
        user.username.toLowerCase().includes(searchLower)
    );
    setFilteredUsers(filtered);
    setSelectedIndex(0);
  }, [query, users]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (filteredUsers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < filteredUsers.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
      }
    },
    [filteredUsers, selectedIndex, onSelect, onClose]
  );

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = dropdownRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  if (isLoading) {
    return (
      <div
        ref={dropdownRef}
        className={clsx(
          'absolute z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg',
          'border border-gray-200 dark:border-gray-700 overflow-hidden'
        )}
        style={{ top: position.top, left: position.left }}
      >
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <div className="animate-spin inline-block w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
          <span className="ml-2 text-sm">Lade Benutzer...</span>
        </div>
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div
        ref={dropdownRef}
        className={clsx(
          'absolute z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg',
          'border border-gray-200 dark:border-gray-700 overflow-hidden'
        )}
        style={{ top: position.top, left: position.left }}
      >
        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          <AtSign className="w-5 h-5 mx-auto mb-1 opacity-50" />
          Keine Benutzer gefunden
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className={clsx(
        'absolute z-50 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg',
        'border border-gray-200 dark:border-gray-700 overflow-hidden'
      )}
      style={{ top: position.top, left: position.left }}
    >
      <div className="max-h-60 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          Erwähnen mit @
          <span className="ml-2 text-gray-400 dark:text-gray-500">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'Person' : 'Personen'}
          </span>
        </div>
        <div className="py-1">
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              data-index={index}
              onClick={() => onSelect(user)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                index === selectedIndex && 'bg-primary-50 dark:bg-primary-900/20'
              )}
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  )}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.name}
                  </span>
                  {user.status === 'online' && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                  @{user.username}
                </span>
              </div>

              {/* Check icon for selected */}
              {index === selectedIndex && (
                <div className="flex-shrink-0 text-primary-600 dark:text-primary-400">
                  <span className="text-xs">Tab</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between">
        <span>↑↓ Navigation</span>
        <span>↵ Auswählen</span>
        <span>Esc Schließen</span>
      </div>
    </div>
  );
}
