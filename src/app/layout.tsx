import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers";
import { ChatSearch } from "@/components/chat";

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
    <html lang="de" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <ChatSearch />
        </ThemeProvider>
      </body>
    </html>
  );
}
