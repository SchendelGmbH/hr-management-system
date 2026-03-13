'use client';

import { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { TasksKanban } from '@/components/tasks/TasksKanban';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function TasksPage() {
  const t = useTranslations('tasks');
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('description')}</p>
        </div>
        <TasksKanban />
      </div>
    </QueryClientProvider>
  );
}
