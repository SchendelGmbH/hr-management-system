export const dynamic = 'force-dynamic';
export const revalidate = 0;

import RootLayoutClient from './RootLayoutClient';

export const metadata = {
  title: "HR Management System",
  description: "Comprehensive HR Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootLayoutClient>{children}</RootLayoutClient>;
}
