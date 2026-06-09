import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ShieldX } from 'lucide-react';

export default async function NoPermissionPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldX className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-gray-900">Keine Berechtigung</h1>
        <p className="mb-8 text-gray-600">
          Sie haben keine Berechtigung, auf diese Seite zuzugreifen. Bitte wenden Sie sich an Ihren
          Administrator, falls Sie glauben, dass dies ein Fehler ist.
        </p>
        <a
          href="/de"
          className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700"
        >
          Zurück zum Dashboard
        </a>
      </div>
    </div>
  );
}