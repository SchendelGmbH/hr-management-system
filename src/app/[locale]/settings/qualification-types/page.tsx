'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';

type QualificationGroup = 'INSTRUCTION' | 'CERTIFICATE' | 'TRAINING';

interface QualificationType {
  id: string;
  name: string;
  group: QualificationGroup;
  recurringIntervalMonths: number | null;
  isActive: boolean;
  _count: { qualifications: number };
}

interface FormState {
  name: string;
  recurringIntervalMonths: string;
}

const GROUP_LABELS: Record<QualificationGroup, string> = {
  INSTRUCTION: 'Unterweisungen',
  CERTIFICATE: 'Zertifikate & Lizenzen',
  TRAINING: 'Fortbildungen',
};

const GROUP_ORDER: QualificationGroup[] = ['INSTRUCTION', 'CERTIFICATE', 'TRAINING'];

const emptyForm: FormState = { name: '', recurringIntervalMonths: '' };

function intervalLabel(months: number | null): string {
  if (!months) return 'Einmalig';
  if (months === 12) return 'Jährlich';
  if (months === 6) return 'Alle 6 Monate';
  if (months === 24) return 'Alle 2 Jahre';
  if (months === 36) return 'Alle 3 Jahre';
  if (months === 48) return 'Alle 4 Jahre';
  if (months === 60) return 'Alle 5 Jahre';
  return `Alle ${months} Monate`;
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

export default function QualificationTypesPage() {
  const [types, setTypes] = useState<QualificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState<QualificationGroup | null>(null);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<QualificationType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { fetchTypes(); }, []);

  const fetchTypes = async () => {
    try {
      const res = await fetch('/api/qualification-types');
      const data = await res.json();
      setTypes(data.types ?? []);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (group: QualificationGroup) => {
    if (!addForm.name.trim()) { setAddError('Name ist erforderlich'); return; }
    setSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/qualification-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          group,
          recurringIntervalMonths: addForm.recurringIntervalMonths
            ? parseInt(addForm.recurringIntervalMonths, 10)
            : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setAddError(d.error || 'Fehler'); return; }
      setAddForm(emptyForm);
      setShowAdd(null);
      fetchTypes();
    } catch { setAddError('Netzwerkfehler'); } finally { setSaving(false); }
  };

  const startEdit = (t: QualificationType) => {
    setEditId(t.id);
    setEditForm({
      name: t.name,
      recurringIntervalMonths: t.recurringIntervalMonths != null ? String(t.recurringIntervalMonths) : '',
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/qualification-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          recurringIntervalMonths: editForm.recurringIntervalMonths
            ? parseInt(editForm.recurringIntervalMonths, 10)
            : null,
        }),
      });
      if (res.ok) { setEditId(null); fetchTypes(); }
    } catch { /* noop */ } finally { setSaving(false); }
  };

  const handleDelete = async (t: QualificationType) => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/qualification-types/${t.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setDeleteError(d.error || 'Fehler beim Löschen'); return; }
      setDeleteConfirm(null);
      fetchTypes();
    } catch { setDeleteError('Netzwerkfehler'); } finally { setDeleting(false); }
  };

  const groupedTypes: Record<QualificationGroup, QualificationType[]> = {
    INSTRUCTION: [],
    CERTIFICATE: [],
    TRAINING: [],
  };
  for (const t of types) {
    groupedTypes[t.group].push(t);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">
            &larr; Zurück zu Einstellungen
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Qualifikationstypen</h1>
          <p className="mt-2 text-sm text-gray-600">Typen für Unterweisungen, Zertifikate und Fortbildungen verwalten</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((group) => (
            <div key={group} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">{GROUP_LABELS[group]}</h2>
                <button
                  onClick={() => { setShowAdd(group); setAddForm(emptyForm); setAddError(''); }}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" />
                  Neuer Typ
                </button>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Wiederholung</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Zugewiesen</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Add row */}
                  {showAdd === group && (
                    <tr className="bg-primary-50">
                      <td className="px-4 py-2">
                        <input
                          autoFocus
                          value={addForm.name}
                          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAdd(group)}
                          placeholder="z.B. Brandschutzunterweisung"
                          className={inputClass}
                        />
                        {addError && <p className="mt-1 text-xs text-red-600">{addError}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={addForm.recurringIntervalMonths}
                          onChange={(e) => setAddForm({ ...addForm, recurringIntervalMonths: e.target.value })}
                          placeholder="Monate (leer = einmalig)"
                          className={inputClass}
                        />
                      </td>
                      <td className="px-4 py-2 text-gray-400">—</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleAdd(group)} disabled={saving} className="rounded p-1.5 text-green-600 hover:bg-green-50">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setShowAdd(null)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {groupedTypes[group].length === 0 && showAdd !== group ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                        Noch keine Typen angelegt – klicken Sie auf &quot;Neuer Typ&quot;
                      </td>
                    </tr>
                  ) : (
                    groupedTypes[group].map((t) =>
                      editId === t.id ? (
                        <tr key={t.id} className="bg-primary-50">
                          <td className="px-4 py-2">
                            <input
                              autoFocus
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(t.id)}
                              className={inputClass}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="1"
                              max="120"
                              value={editForm.recurringIntervalMonths}
                              onChange={(e) => setEditForm({ ...editForm, recurringIntervalMonths: e.target.value })}
                              placeholder="Monate (leer = einmalig)"
                              className={inputClass}
                            />
                          </td>
                          <td className="px-4 py-2 text-gray-500">{t._count.qualifications}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleSaveEdit(t.id)} disabled={saving} className="rounded p-1.5 text-green-600 hover:bg-green-50">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => setEditId(null)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                          <td className="px-4 py-3 text-gray-600">{intervalLabel(t.recurringIntervalMonths)}</td>
                          <td className="px-4 py-3 text-gray-600">{t._count.qualifications}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEdit(t)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setDeleteConfirm(t); setDeleteError(''); }}
                                disabled={t._count.qualifications > 0}
                                title={t._count.qualifications > 0 ? 'Nicht löschbar – Qualifikationen zugewiesen' : 'Löschen'}
                                className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Qualifikationstyp löschen</h3>
            <p className="mt-2 text-sm text-gray-600">
              Möchten Sie <strong>{deleteConfirm.name}</strong> wirklich löschen?
            </p>
            {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
            <div className="mt-4 flex justify-end space-x-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Wird gelöscht…' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
