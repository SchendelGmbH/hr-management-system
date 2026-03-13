'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Settings,
  LogOut,
  Download,
  ShoppingCart,
  Package,
  Award,
  ClipboardList,
  MessageCircle,
  ArrowRightLeft,
  CheckSquare,
  Bell,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket';

const allNavigation = [
  {
    name: 'dashboard',
    href: '/de',
    icon: LayoutDashboard,
    adminOnly: false,
  },
  {
    name: 'employees',
    href: '/de/employees',
    icon: Users,
    adminOnly: false,
  },
  {
    name: 'documents',
    href: '/de/documents',
    icon: FileText,
    adminOnly: false,
  },
  {
    name: 'orders',
    href: '/de/clothing/orders',
    icon: ShoppingCart,
    adminOnly: false,
  },
  {
    name: 'items',
    href: '/de/clothing/items',
    icon: Package,
    adminOnly: false,
  },
  {
    name: 'woocommerceImport',
    href: '/de/clothing/woocommerce-import',
    icon: Download,
    adminOnly: false,
  },
  {
    name: 'calendar',
    href: '/de/calendar',
    icon: Calendar,
    adminOnly: false,
  },
  {
    name: 'planning',
    href: '/de/planning',
    icon: ClipboardList,
    adminOnly: false,
  },
  {
    name: 'qualifications',
    href: '/de/qualifications',
    icon: Award,
    adminOnly: false,
  },
  {
    name: 'mySchedule',
    href: '/de/my-schedule',
    icon: Calendar,
    adminOnly: false,
  },
  {
    name: 'chat',
    href: '/de/chat',
    icon: MessageCircle,
    adminOnly: false,
    showBadge: true,
  },
  {
    name: 'tasks',
    href: '/de/tasks',
    icon: CheckSquare,
    adminOnly: false,
  },
  {
    name: 'swaps',
    href: '/de/swaps',
    icon: ArrowRightLeft,
    adminOnly: false,
  },
  {
    name: 'settings',
    href: '/de/settings',
    icon: Settings,
    adminOnly: false,
  },
  {
    name: 'notifications',
    href: '/de/notifications',
    icon: Bell,
    adminOnly: false,
    showBadge: true,
  },
];

interface UnreadCounts {
  chat: number;
  notifications: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const isUser = session?.user?.role === 'USER';
  const { socket, isConnected, isAuthenticated } = useSocket();
  
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ chat: 0, notifications: 0 });

  const navigation = isUser
    ? allNavigation.filter((item) => 
        item.name === 'planning' || 
        item.name === 'calendar' || 
        item.name === 'mySchedule' ||
        item.name === 'swaps' ||
        item.name === 'chat' ||
        item.name === 'tasks' ||
        item.name === 'notifications'
      )
    : allNavigation;

  // Fetch initial unread counts
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchUnreadCounts = async () => {
      try {
        // Fetch chat unread count
        const chatResponse = await fetch('/api/chat/rooms');
        if (chatResponse.ok) {
          const data = await chatResponse.json();
          const chatUnread = (data.rooms || []).reduce((sum: number, room: any) => sum + (room.unreadCount || 0), 0);
          setUnreadCounts(prev => ({ ...prev, chat: chatUnread }));
        }

        // Fetch notification unread count
        const notifResponse = await fetch('/api/notifications/unread-count');
        if (notifResponse.ok) {
          const data = await notifResponse.json();
          setUnreadCounts(prev => ({ ...prev, notifications: data.count || 0 }));
        }
      } catch (error) {
        console.error('[Sidebar] Error fetching unread counts:', error);
      }
    };

    fetchUnreadCounts();
    
    // Poll for updates every 30 seconds as fallback
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // Listen for real-time socket updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleChatUnreadUpdate = () => {
      // Refetch chat unread count
      fetch('/api/chat/rooms')
        .then(res => res.json())
        .then(data => {
          const chatUnread = (data.rooms || []).reduce((sum: number, room: any) => sum + (room.unreadCount || 0), 0);
          setUnreadCounts(prev => ({ ...prev, chat: chatUnread }));
        })
        .catch(err => console.error('[Sidebar] Error fetching chat unread:', err));
    };

    const handleChatUnreadCount = (data: { count: number }) => {
      if (typeof data.count === 'number') {
        setUnreadCounts(prev => ({ ...prev, chat: data.count }));
      }
    };

    const handleNotificationCount = (data: { count: number }) => {
      if (typeof data.count === 'number') {
        setUnreadCounts(prev => ({ ...prev, notifications: data.count }));
      }
    };

    const handleNewMessage = () => {
      handleChatUnreadUpdate();
    };

    socket.on('chat:unread-update', handleChatUnreadUpdate);
    socket.on('chat:unread-count', handleChatUnreadCount);
    socket.on('notification:unread-count', handleNotificationCount);
    socket.on('new-message', handleNewMessage);

    // Subscribe to notifications on socket connect
    if (isAuthenticated) {
      socket.emit('subscribe-notifications');
    }

    return () => {
      socket.off('chat:unread-update', handleChatUnreadUpdate);
      socket.off('chat:unread-count', handleChatUnreadCount);
      socket.off('notification:unread-count', handleNotificationCount);
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, isConnected, isAuthenticated]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const getBadgeCount = (name: string): number => {
    if (name === 'chat') return unreadCounts.chat;
    if (name === 'notifications') return unreadCounts.notifications;
    return 0;
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-800 px-6">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">HR System</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const badgeCount = getBadgeCount(item.name);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span>{t(item.name)}</span>
              </div>
              {(item.showBadge && badgeCount > 0) && (
                <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-800 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          <span>Abmelden</span>
        </button>
      </div>
    </div>
  );
}
