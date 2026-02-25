'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

const SNOOZE_OPTIONS = [
  { label: '7 Tage', days: 7 },
  { label: '30 Tage', days: 30 },
  { label: '90 Tage', days: 90 },
  { label: '180 Tage', days: 180 },
  { label: '365 Tage', days: 365 },
];

export default function SnoozeDropdown({ docId, isSnoozed }: { docId: string; isSnoozed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Schließen bei Klick außerhalb
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSnooze = async (days: number) => {
    setOpen(false);
    setLoading(true);
    const snoozedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    try {
      await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozedUntil }),
      });
      router.refresh();
    } catch (err) {
      console.error('Snooze fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsnooze = async () => {
    setOpen(false);
    setLoading(true);
    try {
      await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozedUntil: null }),
      });
      router.refresh();
    } catch (err) {
      console.error('Unsnooze fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        disabled={loading}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        title={isSnoozed ? 'Snooze aufheben' : 'Erinnerung verschieben'}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg">
          {isSnoozed ? (
            <>
              <div className="border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-500">
                Snooze aufheben
              </div>
              <button
                onClick={handleUnsnooze}
                className="w-full rounded-b-lg px-3 py-2 text-left text-sm text-primary-600 hover:bg-primary-50"
              >
                Wieder aktiv anzeigen
              </button>
            </>
          ) : (
            <>
              <div className="border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-500">
                Erinnere mich erst in…
              </div>
              {SNOOZE_OPTIONS.map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => handleSnooze(days)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first-of-type:rounded-t-lg last-of-type:rounded-b-lg"
                >
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
