'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useMemo } from 'react';
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
  LayoutGrid,
  Shield,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket';
import { useModules } from '@/hooks/useModules';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useUserModules } from '@/hooks/useUserModules';

// Icon mapping
const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  LayoutDashboard,
  Users,
  FileText,
  ShoppingCart,
  Calendar,
  ClipboardList,
  Award,
  ArrowRightLeft,
  CheckSquare,
  MessageCircle,
  PenTool: Bell, // Fallback
  Bell,
  Package,
  Download,
  LayoutGrid,
};

// Navigation items with module keys
const allNavigation = [
  { name: 'dashboard', href: '/de', icon: LayoutDashboard, moduleKey: 'dashboard' },
  { name: 'employees', href: '/de/employees', icon: Users, moduleKey: 'employees' },
  { name: 'documents', href: '/de/documents', icon: FileText, moduleKey: 'documents' },
  { name: 'orders', href: '/de/clothing/orders', icon: ShoppingCart, moduleKey: 'clothing' },
  { name: 'items', href: '/de/clothing/items', icon: Package, moduleKey: 'clothing' },
  { name: 'woocommerceImport', href: '/de/clothing/woocommerce-import', icon: Download, moduleKey: 'clothing' },
  { name: 'calendar', href: '/de/calendar', icon: Calendar, moduleKey: 'calendar' },
  { name: 'planning', href: '/de/planning', icon: ClipboardList, moduleKey: 'planning' },
  { name: 'qualifications', href: '/de/qualifications', icon: Award, moduleKey: 'qualifications' },
  { name: 'mySchedule', href: '/de/my-schedule', icon: Calendar, moduleKey: 'calendar' },
  { name: 'chat', href: '/de/chat', icon: MessageCircle, moduleKey: 'chat', showBadge: true },
  { name: 'tasks', href: '/de/tasks', icon: CheckSquare, moduleKey: 'tasks' },
  { name: 'swaps', href: '/de/swaps', icon: ArrowRightLeft, moduleKey: 'shiftSwap' },
  { name: 'settings', href: '/de/settings', icon: Settings, moduleKey: null }, // Always visible
  { name: 'notifications', href: '/de/notifications', icon: Bell, moduleKey: 'notifications', showBadge: true },
];

// Admin-only navigation items
const adminNavigation = [
  { name: 'moduleManagement', href: '/de/admin/modules', icon: Shield, adminOnly: true },
];

interface UnreadCounts {
  chat: number;
  notifications: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const { activeModules, isLoading: modulesLoading } = useModules();
  const { allowedModuleKeys, isLoading: userModulesLoading } = useUserModules();
  const { settings: systemSettings, isLoading: settingsLoading } = useSystemSettings();
  const { 
    isConnected, 
    isAuthenticated,
    onChatUnreadCount,
    onNotificationCount,
  } = useSocket();
  
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ chat: 0, notifications: 0 });

  // Get active module keys
  const activeModuleKeys = useMemo(() => 
    new Set(activeModules.map(m => m.key)),
    [activeModules]
  );

  // Filter navigation based on modules, user permissions, and system settings
  const navigation = useMemo(() => {
    let items = allNavigation.filter((item) => {
      // Settings is always visible
      if (item.moduleKey === null) return true;
      // Filter by active modules
      if (!activeModuleKeys.has(item.moduleKey)) return false;
      // Filter by user module permissions (admin sees all)
      if (isAdmin) return true;
      return allowedModuleKeys.has(item.moduleKey);
    });

    // Filter out shift swap menu if forbidden (but keep mySchedule)
    if (systemSettings?.shiftSwap?.mode === 'forbidden') {
      items = items.filter((item) => item.name !== 'swaps');
    }

    // Add admin-only items for admins
    if (isAdmin) {
      items = [...items, ...adminNavigation];
    }

    return items;
  }, [activeModuleKeys, allowedModuleKeys, isAdmin, systemSettings]);

  // Listen for notification count updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeNotif = onNotificationCount((data: { count: number }) => {
      if (typeof data.count === 'number') {
        setUnreadCounts(prev => ({ ...prev, notifications: data.count }));
      }
    });

    const unsubscribeChat = onChatUnreadCount((data: { count: number }) => {
      if (typeof data.count === 'number') {
        setUnreadCounts(prev => ({ ...prev, chat: data.count }));
      }
    });

    return () => {
      unsubscribeNotif();
      unsubscribeChat();
    };
  }, [isConnected, onNotificationCount, onChatUnreadCount]);

  // Fallback: Poll for chat unread count every 10 seconds
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchChatUnreadCount = async () => {
      try {
        const response = await fetch('/api/chat/rooms');
        if (response.ok) {
          const data = await response.json();
          const chatUnread = (data.rooms || []).reduce((sum: number, room: any) => sum + (room.unreadCount || 0), 0);
          setUnreadCounts(prev => ({ ...prev, chat: chatUnread }));
        }
      } catch (error) {
        console.error('[Sidebar] Error polling chat unread count:', error);
      }
    };

    fetchChatUnreadCount();
    const interval = setInterval(fetchChatUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const getBadgeCount = (name: string): number => {
    return name === 'chat' ? unreadCounts.chat : name === 'notifications' ? unreadCounts.notifications : 0;
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
        {modulesLoading || settingsLoading || userModulesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          navigation.map((item) => {
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
          })
        )}
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
