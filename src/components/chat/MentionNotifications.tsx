'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, 
  Check, 
  X, 
  AtSign,
  MessageCircle,
  Trash2,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import Link from 'next/link';
import { clsx } from 'clsx';
import { MentionHistoryItem } from '@/types/chat';

export function MentionNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [showRead, setShowRead] = useState(false);
  const queryClient = useQueryClient();

  // Fetch mentions
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mentions', showRead],
    queryFn: async () => {
      const response = await fetch(`/api/chat/mentions?includeRead=${showRead}`);
      if (!response.ok) throw new Error('Failed to fetch mentions');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const mentions = data?.mentions || [];
  const unreadCount = data?.unreadCount || 0;

  // Mark mentions as read mutation
  const markAsRead = useMutation({
    mutationFn: async (mentionIds: string[]) => {
      const response = await fetch('/api/chat/mentions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentionIds }),
      });
      if (!response.ok) throw new Error('Failed to mark mentions as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
    },
  });

  // Mark all as read mutation
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/chat/mentions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
    },
  });

  // Delete mention mutation
  const deleteMention = useMutation({
    mutationFn: async (mentionIds: string[]) => {
      const response = await fetch('/api/chat/mentions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentionIds }),
      });
      if (!response.ok) throw new Error('Failed to delete mentions');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
    },
  });

  // Close dropdown on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.mention-notifications-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div className="mention-notifications-container relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'relative p-2 rounded-lg transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          isOpen && 'bg-gray-100 dark:bg-gray-800'
        )}
        aria-label={`${unreadCount} ungelesene Erwähnungen`}
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <AtSign className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Erwähnungen
              </h3>
              {!isLoading && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({unreadCount} ungelesen)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Filter toggle */}
              <button
                onClick={() => setShowRead(!showRead)}
                className={clsx(
                  'text-xs px-2 py-1 rounded-md transition-colors',
                  showRead
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                {showRead ? 'Alle' : 'Nur Ungelesene'}
              </button>
              
              {/* Mark all as read */}
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead.mutate()}
                  disabled={markAllAsRead.isPending}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  title="Alle als gelesen markieren"
                >
                  {markAllAsRead.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              )}
              
              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                <span className="ml-2 text-gray-500">Lade Erwähnungen...</span>
              </div>
            ) : isError ? (
              <div className="py-8 text-center text-gray-500">
                <p>Fehler beim Laden der Erwähnungen</p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['mentions'] })}
                  className="mt-2 text-primary-600 hover:underline"
                >
                  Erneut versuchen
                </button>
              </div>
            ) : mentions.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <AtSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {showRead 
                    ? 'Keine Erwähnungen vorhanden' 
                    : 'Keine ungelesenen Erwähnungen'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {mentions.map((mention: MentionHistoryItem) => (
                  <div
                    key={mention.id}
                    className={clsx(
                      'px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                      !mention.isRead && 'bg-primary-50/50 dark:bg-primary-900/10'
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-300 flex-shrink-0">
                          {mention.senderName.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            <span className="font-semibold">{mention.senderName}</span>{' '}
                            hat dich erwähnt
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {mention.roomName} · {formatDistanceToNow(new Date(mention.mentionedAt), { addSuffix: true, locale: de })}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 ml-2">
                        {!mention.isRead && (
                          <button
                            onClick={() => markAsRead.mutate([mention.id])}
                            disabled={markAsRead.isPending}
                            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600"
                            title="Als gelesen markieren"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteMention.mutate([mention.id])}
                          disabled={deleteMention.isPending}
                          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-danger-600"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Content preview */}
                    <Link
                      href={`/chat?room=${mention.roomId}&message=${mention.messageId}`}
                      className="block mt-2"
                      onClick={() => {
                        setIsOpen(false);
                        if (!mention.isRead) {
                          markAsRead.mutate([mention.id]);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-2 flex-1">
                          {mention.content}
                        </p>
                        <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      </div>
                    </Link>

                    {/* Unread indicator */}
                    {!mention.isRead && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary-500" />
                        <span className="text-xs text-primary-600 dark:text-primary-400">
                          Ungelesen
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {mentions.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <Link
                href="/chat?mentions=true"
                className="flex items-center justify-center text-sm text-primary-600 hover:text-primary-700"
                onClick={() => setIsOpen(false)}
              >
                <span>Alle Erwähnungen anzeigen</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
