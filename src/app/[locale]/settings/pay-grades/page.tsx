'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';

interface PayGrade {
  id: string;
  name: string;
  description: string | null;
  tariffWage: number | null;
  _count: { employees: number };
}

interface FormState {
  name: string;
  description: string;
  tariffWage: string;
}

const emptyForm: FormState = { name: '', description: '', tariffWage: '' };

export default function PayGradesPage() {
  const [payGrades, setPayGrades] = useState<PayGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<PayGrade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { fetchPayGrades(); }, []);

  const fetchPayGrades = async () => {
    try {
      const res = await fetch('/api/pay-grades');
      const data = await res.json();
      setPayGrades(data.payGrades ?? []);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) { setAddError('Name ist erforderlich'); return; }
    setSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/pay-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          description: addForm.description.trim() || null,
          tariffWage: addForm.tariffWage ? Number(addForm.tariffWage) : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setAddError(d.error || 'Fehler'); return; }
      setAddForm(emptyForm);
      setShowAdd(false);
      fetchPayGrades();
    } catch { setAddError('Netzwerkfehler'); } finally { setSaving(false); }
  };

  const startEdit = (pg: PayGrade) => {
    setEditId(pg.id);
    setEditForm({
      name: pg.name,
      description: pg.description ?? '',
      tariffWage: pg.tariffWage != null ? String(pg.tariffWage) : '',
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pay-grades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          tariffWage: editForm.tariffWage ? Number(editForm.tariffWage) : null,
        }),
      });
      if (res.ok) { setEditId(null); fetchPayGrades(); }
    } catch { /* noop */ } finally { setSaving(false); }
  };

  const handleDelete = async (pg: PayGrade) => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/pay-grades/${pg.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); setDeleteError(d.error || 'Fehler beim Löschen'); return; }
      setDeleteConfirm(null);
      fetchPayGrades();
    } catch { setDeleteError('Netzwerkfehler'); } finally { setDeleting(false); }
  };

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">
            &larr; Zurück zu Einstellungen
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Lohngruppen</h1>
          <p className="mt-2 text-sm text-gray-600">Tariflohngruppen verwalten</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddForm(emptyForm); setAddError(''); }}
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          <span>Neue Lohngruppe</span>
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Beschreibung</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Tariflohn (€/h)</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Mitarbeiter</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Neue Zeile */}
            {showAdd && (
              <tr className="bg-primary-50">
                <td className="px-4 py-2">
                  <input
                    autoFocus
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="z.B. LG 1"
                    className={inputClass}
                  />
                  {addError && <p className="mt-1 text-xs text-red-600">{addError}</p>}
                </td>
                <td className="px-4 py-2">
                  <input
                    value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    placeholder="Beschreibung (optional)"
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.tariffWage}
                    onChange={(e) => setAddForm({ ...addForm, tariffWage: e.target.value })}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-2 text-gray-400">—</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={handleAdd} disabled={saving} className="rounded p-1.5 text-green-600 hover:bg-green-50">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setShowAdd(false)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Laden…</td></tr>
            ) : payGrades.length === 0 && !showAdd ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Noch keine Lohngruppen angelegt</td></tr>
            ) : (
              payGrades.map((pg) =>
                editId === pg.id ? (
                  <tr key={pg.id} className="bg-primary-50">
                    <td className="px-4 py-2">
                      <input
                        autoFocus
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(pg.id)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.tariffWage}
                        onChange={(e) => setEditForm({ ...editForm, tariffWage: e.target.value })}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-500">{pg._count.employees}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleSaveEdit(pg.id)} disabled={saving} className="rounded p-1.5 text-green-600 hover:bg-green-50">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={pg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{pg.name}</td>
                    <td className="px-4 py-3 text-gray-600">{pg.description ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {pg.tariffWage != null ? `${Number(pg.tariffWage).toFixed(2)} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{pg._count.employees}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(pg)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setDeleteConfirm(pg); setDeleteError(''); }} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
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

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Lohngruppe löschen</h3>
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
