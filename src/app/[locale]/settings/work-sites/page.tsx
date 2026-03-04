'use client';

import { useState, useEffect } from 'react';
import { Trash2, Info } from 'lucide-react';
import Link from 'next/link';

interface WorkSite {
  id: string;
  name: string;
  location: string | null;
  defaultVehiclePlate: string | null;
  defaultStartTime: string;
  defaultEndTime: string;
  lastUsedAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function WorkSitesSettingsPage() {
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkSite | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/work-sites')
      .then((r) => r.json())
      .then((d) => setWorkSites(d.workSites ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (ws: WorkSite) => {
    setDeleting(true);
    try {
      await fetch(`/api/work-sites/${ws.id}`, { method: 'DELETE' });
      setWorkSites((prev) => prev.filter((w) => w.id !== ws.id));
      setDeleteConfirm(null);
    } catch { /* noop */ } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">
          &larr; Zurück zu Einstellungen
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Stammbaustellen</h1>
        <p className="mt-2 text-sm text-gray-600">Automatisch verwaltete Liste der zuletzt verwendeten Baustellen</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Baustellen werden automatisch hinzugefügt wenn sie in der Tagesplanung verwendet werden.
          Baustellen die <strong>30 Tage lang nicht verwendet</strong> wurden, werden automatisch entfernt.
        </span>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : workSites.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
          <p>Noch keine Baustellen vorhanden</p>
          <Link href="/de/planning" className="mt-2 text-sm text-primary-600 hover:underline">
            Zur Tagesplanung
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Ort</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Letztes Kennzeichen</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Standard-Zeit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Zuletzt verwendet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workSites.map((ws) => (
                <tr key={ws.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ws.name}</td>
                  <td className="px-4 py-3 text-gray-600">{ws.location ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{ws.defaultVehiclePlate ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{ws.defaultStartTime}–{ws.defaultEndTime}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(ws.lastUsedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteConfirm(ws)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Baustelle entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Stammbaustelle entfernen</h3>
            <p className="mt-2 text-sm text-gray-600">
              <strong>{deleteConfirm.name}</strong>{deleteConfirm.location ? ` (${deleteConfirm.location})` : ''} aus den Stammbaustellen entfernen?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Wird entfernt…' : 'Entfernen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
