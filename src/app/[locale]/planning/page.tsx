import { redirect } from 'next/navigation';

export default function PlanningPage() {
  const today = new Date().toISOString().split('T')[0];
  redirect(`/de/planning/${today}`);
}
