'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ChatViewV2 } from './ChatViewV2';

export default function ChatPage() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  // DEBUG: Globaler Context-Menu Test
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      console.log('DEBUG: Global contextmenu event', e.target);
      alert('DEBUG: Global Rechtsklick erkannt auf: ' + (e.target as HTMLElement).tagName);
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ChatViewV2 />
    </QueryClientProvider>
  );
}
