import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TasksKanban } from '@/components/tasks/TasksKanban';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tasks' });
  return {
    title: `${t('title')} | HR Management`,
  };
}

export default function TasksPage() {
  return <TasksKanban />;
}
