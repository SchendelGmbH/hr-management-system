'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Settings, Plus, Pencil, Trash2, Loader2, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count?: { users: number };
}

const ROLE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  ADMIN: { bg: 'bg-orange-100', border: 'border-orange-200', label: 'Administrator' },
  MITARBEITER: { bg: 'bg-blue-100', border: 'border-blue-200', label: 'Mitarbeiter' },
  GEWERBLICH: { bg: 'bg-yellow-100', border: 'border-yellow-200', label: 'Gewerblich' },
  PERSONALVERWALTUNG: { bg: 'bg-purple-100', border: 'border-purple-200', label: 'Personalverwaltung' },
};

function RoleFormModal({
  role,
  onClose,
  onSave,
}: {
  role: Role | null;
  onClose: () => void;
  onSave: (data: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState(role?.name === 'ADMIN' ? 'Administrator' : role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!role;
  const isAdmin = role?.name === 'ADMIN';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name erforderlich'); return; }
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? '/api/roles' : '/api/roles';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { id: role.id, name: name.trim(), description: description.trim() || undefined }
                         : { name: name.trim(), description: description.trim() || undefined };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fehler'); return; }
      onSave(data);
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Rolle bearbeiten' : 'Neue Rolle erstellen'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isAdmin}
              placeholder="z.B. Sachbearbeiter"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung der Rolle..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ role, onClose, onConfirm }: { role: Role; onClose: () => void; onConfirm: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/roles?id=${role.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fehler'); return; }
      onConfirm();
    } catch { setError('Netzwerkfehler'); }
    finally { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-full bg-red-100 p-2"><Trash2 className="h-5 w-5 text-red-600" /></div>
            <h2 className="text-lg font-bold text-gray-900">Rolle löschen?</h2>
          </div>
          <p className="text-sm text-gray-600 mb-1">Möchtest du die Rolle <strong>{ROLE_COLORS[role.name]?.label ?? role.name}</strong> wirklich löschen?</p>
          {role._count?.users ? (
            <p className="text-sm text-orange-600">⚠️ {role._count.users} Mitarbeiter haben diese Rolle</p>
          ) : <p className="text-sm text-gray-500">Diese Rolle ist aktuell keinem Mitarbeiter zugewiesen.</p>}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
          <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formRole, setFormRole] = useState<Role | null>(null); // null = create mode
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [saved, setSaved] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setRoles(data);
    } catch { setError('Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  function handleSave(data: { name: string; description: string }) {
    if (formRole) {
      // Edit
      setRoles(prev => prev.map(r => r.id === formRole.id ? { ...r, ...data } : r));
    } else {
      // Create — add to list (API returns new role with id)
      loadRoles();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setFormRole(null);
  }

  function handleDelete() {
    if (!deleteRole) return;
    setRoles(prev => prev.filter(r => r.id !== deleteRole.id));
    setDeleteRole(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">← Zurück zu Einstellungen</Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Rollenverwaltung</h1>
          <p className="mt-2 text-sm text-gray-600">Rollen definieren die Berechtigungen für Portal-Zugriffe</p>
        </div>
        <button
          onClick={() => setFormRole(null)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Neue Rolle
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
      ) : (
        <div className="space-y-3">
          {roles.map(role => {
            const colors = ROLE_COLORS[role.name] ?? { bg: 'bg-gray-100', border: 'border-gray-200', label: role.name };
            const isAdmin = role.name === 'ADMIN';
            return (
              <div key={role.id} className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white/60 p-2">
                      <Settings className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{colors.label}</h3>
                      <p className="text-sm text-gray-500">{role.description || 'Keine Beschreibung'}</p>
                      {role._count?.users !== undefined && (
                        <p className="text-xs text-gray-400 mt-0.5">{role._count.users} Mitarbeiter mit dieser Rolle</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">Unveränderbar</span>
                    )}
                    {!isAdmin && (
                      <>
                        <button
                          onClick={() => setFormRole(role)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-white/60 hover:text-primary-600 transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteRole(role)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-white/60 hover:text-red-600 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formRole !== undefined && (
        <RoleFormModal
          role={formRole}
          onClose={() => setFormRole(undefined as any)}
          onSave={handleSave}
        />
      )}

      {deleteRole && (
        <DeleteConfirmModal
          role={deleteRole}
          onClose={() => setDeleteRole(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}