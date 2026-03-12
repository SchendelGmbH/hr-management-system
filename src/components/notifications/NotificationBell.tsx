'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/Button';
import { 
  Bell, 
  Check, 
  Archive, 
  Trash2,
  FileText,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const notificationIcons: Record<string, React.ReactNode> = {
  DOCUMENT_EXPIRING: <FileText className="h-4 w-4 text-amber-500" />,
  DOCUMENT_EXPIRED: <FileText className="h-4 w-4 text-red-500" />,
  LOW_BUDGET: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  UPCOMING_VACATION: <Calendar className="h-4 w-4 text-blue-500" />,
  QUALIFICATION_EXPIRING: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  SHIFT_SWAP: <User className="h-4 w-4 text-purple-500" />,
  SHIFT_SWAP_RESPONSE: <User className="h-4 w-4 text-purple-500" />,
  SHIFT_SWAP_APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  SHIFT_SWAP_COMPLETED: <CheckCircle className="h-4 w-4 text-green-500" />,
  TASK_ASSIGNED: <Info className="h-4 w-4 text-blue-500" />,
  TASK_DUE_SOON: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  TASK_OVERDUE: <AlertTriangle className="h-4 w-4 text-red-500" />,
  TASK_COMPLETED: <CheckCircle className="h-4 w-4 text-green-500" />,
  SIGNATURE_REQUESTED: <FileText className="h-4 w-4 text-blue-500" />,
  SIGNATURE_APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
  SIGNATURE_SIGNED: <CheckCircle className="h-4 w-4 text-green-500" />,
  SIGNATURE_REJECTED: <Info className="h-4 w-4 text-red-500" />,
};

const priorityBadges: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-amber-100 text-amber-600',
  URGENT: 'bg-red-100 text-red-600',
};

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    loadMore,
    hasMore,
    refresh,
  } = useNotifications({ onlyUnread: false });

  // Auto refresh when bell is opened
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  if (!session?.user) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        aria-label="Benachrichtigungen"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-xs bg-red-500 text-white rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 max-h-[80vh] bg-white rounded-lg shadow-xl border z-50 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <span className="font-semibold">Benachrichtigungen</span>
                {unreadCount > 0 && (
                  <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {unreadCount} ungelesen
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllAsRead();
                    }}
                    className="h-8 px-2"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Alle
                  </Button>
                )}
                <a href="/notifications/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Laden...</div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">
                    Keine Benachrichtigungen vorhanden
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`relative p-4 hover:bg-gray-50 ${
                        !notification.isRead ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {notificationIcons[notification.type] || (
                            <Info className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`font-medium text-sm ${
                                !notification.isRead ? 'text-gray-900' : 'text-gray-600'
                              }`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400">
                                  {formatDistanceToNow(new Date(notification.createdAt), {
                                    addSuffix: true,
                                    locale: de,
                                  })}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${priorityBadges[notification.priority] || 'bg-gray-100'}`}>
                                  {notification.priority}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="h-8 w-8 p-0"
                                  title="Als gelesen markieren"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  archiveNotification(notification.id);
                                }}
                                className="h-8 w-8 p-0"
                                title="Archivieren"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="h-8 w-8 p-0 text-red-500"
                                title="Löschen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="absolute top-4 left-4 w-2 h-2 bg-blue-500 rounded-full hover:bg-blue-600"
                          title="Als gelesen markieren"
                        />
                      )}
                    </div>
                  ))}

                  {hasMore && (
                    <div className="p-4 text-center">
                      <Button
                        variant="outline"
                        onClick={loadMore}
                        disabled={loading}
                      >
                        {loading ? 'Laden...' : 'Mehr laden'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}