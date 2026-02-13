'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityId: string | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      setNotifications(data.notifications || []);
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

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'DOCUMENT_EXPIRING':
        return 'Dokument läuft ab';
      case 'DOCUMENT_EXPIRED':
        return 'Dokument abgelaufen';
      case 'LOW_BUDGET':
        return 'Niedriges Budget';
      case 'UPCOMING_VACATION':
        return 'Anstehender Urlaub';
      default:
        return type;
    }
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'DOCUMENT_EXPIRING':
        return 'bg-orange-100 text-orange-800';
      case 'DOCUMENT_EXPIRED':
        return 'bg-red-100 text-red-800';
      case 'LOW_BUDGET':
        return 'bg-red-100 text-red-800';
      case 'UPCOMING_VACATION':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Benachrichtigungen</h1>
          <p className="mt-2 text-sm text-gray-600">
            {unreadCount > 0 ? `${unreadCount} ungelesene Benachrichtigungen` : 'Alle Benachrichtigungen gelesen'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <CheckCheck className="h-5 w-5" />
            <span>Alle als gelesen markieren</span>
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-2">
        <Filter className="h-5 w-5 text-gray-400" />
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            filter === 'all'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Alle ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            filter === 'unread'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Ungelesen ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            filter === 'read'
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Gelesen ({notifications.length - unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-500">Laden...</div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <Bell className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {filter === 'all' ? 'Keine Benachrichtigungen' : `Keine ${filter === 'unread' ? 'ungelesenen' : 'gelesenen'} Benachrichtigungen`}
            </h3>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`px-6 py-4 hover:bg-gray-50 ${
                  !notification.isRead ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getNotificationTypeColor(notification.type)}`}
                      >
                        {getNotificationTypeText(notification.type)}
                      </span>
                      {!notification.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-gray-900">
                      {notification.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="ml-4 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                    >
                      Als gelesen markieren
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
