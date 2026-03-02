import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR Management System",
  description: "Comprehensive HR Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
