import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { getAccessibleNav } from '@/lib/rbac';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  await resolvedParams;
  const messages = await getMessages();
  const session = await auth();

  const navItems = session?.user
    ? await getAccessibleNav(session.user.role, session.user.id)
    : [];

  return (
    <SessionProvider>
      <NextIntlClientProvider messages={messages}>
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <Sidebar navItems={navItems} userRole={session?.user?.role ?? 'USER'} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}
