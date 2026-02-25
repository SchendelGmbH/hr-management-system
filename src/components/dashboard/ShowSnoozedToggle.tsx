'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { BellOff } from 'lucide-react';

export default function ShowSnoozedToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const showSnoozed = searchParams.get('showSnoozed') === '1';

  const toggle = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (showSnoozed) {
      params.delete('showSnoozed');
    } else {
      params.set('showSnoozed', '1');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        showSnoozed
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
      }`}
      title={showSnoozed ? 'Gesnoozede Dokumente ausblenden' : 'Gesnoozede Dokumente anzeigen'}
    >
      <BellOff className="h-3.5 w-3.5" />
      {showSnoozed ? 'Gesnoozed sichtbar' : 'Gesnoozed anzeigen'}
    </button>
  );
}
