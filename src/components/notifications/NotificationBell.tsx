'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Check, 
  Archive, 
  Trash2, 
  X,
  FileText,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Info,
  MoreHorizontal,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

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
  SIGNATURE_REJECTED: <X className="h-4 w-4 text-red-500" />,
};

const priorityColors: Record<string, string> = {
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative ${className}`}
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Benachrichtigungen
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadCount} ungelesen
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsRead()}
                  className="h-8 px-2"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Alle gelesen
                </Button>
              )}
              <Link href="/notifications/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          {loading && notifications.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
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
                  className={`relative p-4 hover:bg-gray-50 transition-colors ${
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
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${priorityColors[notification.priority]}`}
                            >
                              {notification.priority}
                            </Badge>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!notification.isRead && (
                              <DropdownMenuItem
                                onClick={() => markAsRead(notification.id)}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Als gelesen markieren
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => archiveNotification(notification.id)}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archivieren
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteNotification(notification.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {notification.actionUrl && (
                        <Link
                          href={notification.actionUrl}
                          onClick={() => {
                            if (!notification.isRead) {
                              markAsRead(notification.id);
                            }
                            setIsOpen(false);
                          }}
                        >
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 mt-2 text-blue-600"
                          >
                            Öffnen →
                          </Button>
                        </Link>
                      )}
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}