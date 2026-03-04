'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Paperclip, Trash2, FileText, RefreshCw, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type QualificationGroup = 'INSTRUCTION' | 'CERTIFICATE' | 'TRAINING';

interface QualificationType {
  id: string;
  name: string;
  group: QualificationGroup;
  recurringIntervalMonths: number | null;
  isActive: boolean;
}

interface Qualification {
  id: string;
  employeeId: string;
  typeId: string;
  type: QualificationType;
  issuedAt: string | null;
  expiresAt: string | null;
  issuer: string | null;
  certNumber: string | null;
  filePath: string | null;
  fileName: string | null;
  notes: string | null;
  createdAt: string;
}

interface GroupedTypes {
  INSTRUCTION: QualificationType[];
  CERTIFICATE: QualificationType[];
  TRAINING: QualificationType[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<QualificationGroup, string> = {
  INSTRUCTION: 'Unterweisungen',
  CERTIFICATE: 'Zertifikate & Lizenzen',
  TRAINING:    'Fortbildungen',
};

const GROUP_ORDER: QualificationGroup[] = ['INSTRUCTION', 'CERTIFICATE', 'TRAINING'];

function getStatus(expiresAt: string | null): 'none' | 'valid' | 'expiring' | 'expired' {
  if (!expiresAt) return 'none';
  const now = new Date();
  const exp = new Date(expiresAt);
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  if (exp < now) return 'expired';
  if (exp <= in60) return 'expiring';
  return 'valid';
}

function StatusBadge({ expiresAt }: { expiresAt: string | null }) {
  const status = getStatus(expiresAt);
  const map = {
    none:     { label: 'Kein Ablauf', cls: 'bg-gray-100 text-gray-600' },
    valid:    { label: 'Gültig',      cls: 'bg-green-100 text-green-700' },
    expiring: { label: 'Läuft bald ab', cls: 'bg-yellow-100 text-yellow-700' },
    expired:  { label: 'Abgelaufen', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('de-DE');
}

function intervalLabel(months: number | null): string {
  if (!months) return 'Einmalig';
  if (months === 12) return 'Jährlich';
  if (months === 6)  return 'Halbjährlich';
  if (months === 24) return 'Alle 2 Jahre';
  return `Alle ${months} Monate`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeQualificationsTab({ employeeId }: { employeeId: string }) {
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [groupedTypes, setGroupedTypes] = useState<GroupedTypes>({ INSTRUCTION: [], CERTIFICATE: [], TRAINING: [] });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'renew'>('add');
  const [editingQual, setEditingQual] = useState<Qualification | null>(null);
  const [defaultGroup, setDefaultGroup] = useState<QualificationGroup>('INSTRUCTION');
  const [deleteConfirm, setDeleteConfirm] = useState<Qualification | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [qualRes, typeRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}/qualifications`),
        fetch('/api/qualification-types'),
      ]);
      const qualData = await qualRes.json();
      const typeData = await typeRes.json();
      setQualifications(qualData.qualifications ?? []);
      setGroupedTypes(typeData.grouped ?? { INSTRUCTION: [], CERTIFICATE: [], TRAINING: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAdd(group: QualificationGroup) {
    setDefaultGroup(group);
    setEditingQual(null);
    setModalMode('add');
    setModalOpen(true);
  }

  function openEdit(q: Qualification) {
    setEditingQual(q);
    setDefaultGroup(q.type.group);
    setModalMode('edit');
    setModalOpen(true);
  }

  function openRenew(q: Qualification) {
    setEditingQual(q);
    setDefaultGroup(q.type.group);
    setModalMode('renew');
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    try {
      await fetch(`/api/qualifications/${deleteConfirm.id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      fetchData();
    } catch {
      alert('Fehler beim Löschen');
    }
  }

  async function handleFileUpload(qualId: string, file: File) {
    setUploadingId(qualId);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/qualifications/${qualId}`, { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? 'Upload fehlgeschlagen');
      } else {
        fetchData();
      }
    } catch {
      alert('Upload fehlgeschlagen');
    } finally {
      setUploadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">Laden...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const qualId = fileInputRef.current?.dataset.qualId;
          if (file && qualId) handleFileUpload(qualId, file);
          e.target.value = '';
        }}
      />

      {GROUP_ORDER.map((group) => {
        const items = qualifications.filter((q) => q.type.group === group);
        return (
          <section key={group}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{GROUP_LABELS[group]}</h3>
              <button
                onClick={() => openAdd(group)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Hinzufügen
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                Keine Einträge
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Typ', 'Ausgestellt', 'Läuft ab', 'Status', 'Aussteller / Nr.', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {items.map((q) => {
                      const status = getStatus(q.expiresAt);
                      const canRenew = q.type.recurringIntervalMonths && (status === 'expired' || status === 'expiring');
                      return (
                        <tr key={q.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{q.type.name}</div>
                            <div className="text-xs text-gray-400">{intervalLabel(q.type.recurringIntervalMonths)}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {formatDate(q.issuedAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                            {formatDate(q.expiresAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <StatusBadge expiresAt={q.expiresAt} />
                          </td>
                          <td className="px-4 py-3">
                            {q.issuer && <div className="text-xs text-gray-700">{q.issuer}</div>}
                            {q.certNumber && <div className="text-xs text-gray-400">Nr: {q.certNumber}</div>}
                            {q.notes && <div className="mt-0.5 text-xs italic text-gray-400">{q.notes}</div>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-1">
                              {/* File */}
                              {q.filePath ? (
                                <a
                                  href={q.filePath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={q.fileName ?? 'Datei öffnen'}
                                  className="rounded p-1 text-blue-500 hover:text-blue-700"
                                >
                                  <FileText className="h-4 w-4" />
                                </a>
                              ) : (
                                <button
                                  title="Datei hochladen"
                                  disabled={uploadingId === q.id}
                                  onClick={() => {
                                    if (fileInputRef.current) {
                                      fileInputRef.current.dataset.qualId = q.id;
                                      fileInputRef.current.click();
                                    }
                                  }}
                                  className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </button>
                              )}

                              {/* Renew */}
                              {canRenew && (
                                <button
                                  onClick={() => openRenew(q)}
                                  title="Verlängern"
                                  className="rounded p-1 text-green-500 hover:text-green-700"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </button>
                              )}

                              {/* Edit */}
                              <button
                                onClick={() => openEdit(q)}
                                title="Bearbeiten"
                                className="rounded p-1 text-gray-400 hover:text-gray-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeleteConfirm(q)}
                                title="Löschen"
                                className="rounded p-1 text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {/* Add / Edit / Renew Modal */}
      {modalOpen && (
        <QualificationModal
          mode={modalMode}
          employeeId={employeeId}
          defaultGroup={defaultGroup}
          groupedTypes={groupedTypes}
          existingQual={editingQual}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); fetchData(); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Eintrag löschen?</h3>
            <p className="mb-6 text-sm text-gray-600">
              <strong>{deleteConfirm.type.name}</strong> wird unwiderruflich gelöscht.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add/Edit/Renew Modal ─────────────────────────────────────────────────────

function QualificationModal({
  mode,
  employeeId,
  defaultGroup,
  groupedTypes,
  existingQual,
  onClose,
  onSuccess,
}: {
  mode: 'add' | 'edit' | 'renew';
  employeeId: string;
  defaultGroup: QualificationGroup;
  groupedTypes: GroupedTypes;
  existingQual: Qualification | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = mode === 'edit';
  const isRenew = mode === 'renew';

  // Calculate next expiry for renewal
  const nextIssuedAt = isRenew && existingQual?.expiresAt
    ? existingQual.expiresAt.split('T')[0]
    : isRenew && existingQual?.issuedAt
    ? existingQual.issuedAt.split('T')[0]
    : '';

  const nextExpiresAt = (() => {
    if (!isRenew || !existingQual) return '';
    const base = existingQual.expiresAt ?? existingQual.issuedAt;
    if (!base || !existingQual.type.recurringIntervalMonths) return '';
    const d = new Date(base);
    d.setMonth(d.getMonth() + existingQual.type.recurringIntervalMonths);
    return d.toISOString().split('T')[0];
  })();

  const [selectedGroup, setSelectedGroup] = useState<QualificationGroup>(defaultGroup);
  const [form, setForm] = useState({
    typeId:     isEdit || isRenew ? existingQual?.typeId ?? '' : '',
    issuedAt:   isEdit ? (existingQual?.issuedAt?.split('T')[0] ?? '') : isRenew ? nextIssuedAt : '',
    expiresAt:  isEdit ? (existingQual?.expiresAt?.split('T')[0] ?? '') : isRenew ? nextExpiresAt : '',
    issuer:     isEdit || isRenew ? existingQual?.issuer ?? '' : '',
    certNumber: isEdit ? existingQual?.certNumber ?? '' : '',
    notes:      isEdit ? existingQual?.notes ?? '' : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableTypes = groupedTypes[selectedGroup].filter((t) => t.isActive);

  // Auto-calculate expiresAt when typeId or issuedAt changes (add/renew mode only)
  useEffect(() => {
    if (isEdit) return;
    const type = [...groupedTypes.INSTRUCTION, ...groupedTypes.CERTIFICATE, ...groupedTypes.TRAINING]
      .find((t) => t.id === form.typeId);
    if (type?.recurringIntervalMonths && form.issuedAt) {
      const d = new Date(form.issuedAt);
      d.setMonth(d.getMonth() + type.recurringIntervalMonths);
      setForm((f) => ({ ...f, expiresAt: d.toISOString().split('T')[0] }));
    }
  }, [form.typeId, form.issuedAt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let res: Response;
      if (isEdit && existingQual) {
        res = await fetch(`/api/qualifications/${existingQual.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        // add or renew → create new
        res = await fetch(`/api/employees/${employeeId}/qualifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Fehler beim Speichern');
        return;
      }
      onSuccess();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? 'Eintrag bearbeiten' : isRenew ? 'Verlängerung erstellen' : 'Neuer Eintrag';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group selector (add/renew mode only) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Gruppe</label>
              <div className="mt-1 flex gap-2">
                {GROUP_ORDER.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setSelectedGroup(g); setForm((f) => ({ ...f, typeId: '' })); }}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedGroup === g ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {GROUP_LABELS[g].split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Typ *</label>
            <select
              required
              value={form.typeId}
              onChange={(e) => setForm({ ...form, typeId: e.target.value })}
              disabled={isEdit}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="">Bitte wählen...</option>
              {availableTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Ausstellungsdatum</label>
              <input
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ablaufdatum</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Issuer + CertNumber */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Aussteller</label>
              <input
                type="text"
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                placeholder="z.B. BG ETEM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Zertifikat-Nr.</label>
              <input
                type="text"
                value={form.certNumber}
                onChange={(e) => setForm({ ...form, certNumber: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Notizen</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
