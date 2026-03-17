'use client';

import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { NotificationInitializer } from "@/components/notifications/NotificationInitializer";

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <SocketProvider>
            <ThemeProvider>
              <ToastProvider>
                <NotificationInitializer />
                {children}
              </ToastProvider>
            </ThemeProvider>
          </SocketProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
