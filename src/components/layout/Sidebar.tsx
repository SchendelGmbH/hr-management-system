'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

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
    name: 'chat',
    href: '/de/chat',
    icon: MessageCircle,
    adminOnly: false,
  },
  {
    name: 'settings',
    href: '/de/settings',
    icon: Settings,
    adminOnly: false,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const isUser = session?.user?.role === 'USER';

  const navigation = isUser
    ? allNavigation.filter((item) => item.name === 'planning' || item.name === 'calendar')
    : allNavigation;

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
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

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{t(item.name)}</span>
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
