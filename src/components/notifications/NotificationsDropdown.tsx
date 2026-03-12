'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityId: string | null;
}

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    // Return color based on notification type
    switch (type) {
      case 'DOCUMENT_EXPIRING':
      case 'DOCUMENT_EXPIRED':
        return 'text-orange-600 dark:text-orange-400';
      case 'LOW_BUDGET':
        return 'text-red-600 dark:text-red-400';
      case 'UPCOMING_VACATION':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'DOCUMENT_EXPIRING':
      case 'DOCUMENT_EXPIRED':
        return 'bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:bg-gray-800 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                Alle als gelesen markieren
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">Laden...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center">
                <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`border-b border-gray-100 px-4 py-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 ${
                    !notification.isRead ? getNotificationBg(notification.type) : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`mt-1 ${getNotificationIcon(notification.type)}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {notification.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        title="Als gelesen markieren"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <Link
                href="/de/notifications"
                className="text-center text-sm text-primary-600 hover:text-primary-700 block dark:text-primary-400"
                onClick={() => setIsOpen(false)}
              >
                Alle Benachrichtigungen anzeigen
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
