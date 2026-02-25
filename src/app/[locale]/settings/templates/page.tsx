'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Upload, ImageOff, FileText } from 'lucide-react';
import TemplateEditorModal from '@/components/templates/TemplateEditorModal';

interface Template {
  id: string;
  name: string;
  description: string | null;
  content: string;
  letterheadPath: string | null;
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const activeUploadId = useRef<string | null>(null);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setError('Fehler beim Laden der Vorlagen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError('Löschen fehlgeschlagen'); return; }
      setDeleteConfirm(null);
      fetchTemplates();
    } catch {
      setError('Netzwerkfehler');
    }
  };

  const handleLetterheadUpload = async (file: File, templateId: string) => {
    setUploadingId(templateId);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/templates/${templateId}/letterhead`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload fehlgeschlagen');
        return;
      }
      fetchTemplates();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveLetterhead = async (templateId: string) => {
    try {
      await fetch(`/api/templates/${templateId}/letterhead`, { method: 'DELETE' });
      fetchTemplates();
    } catch {
      setError('Netzwerkfehler');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dokumentvorlagen</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vorlagen für Verträge und Dokumente mit automatischen Mitarbeitervariablen
          </p>
        </div>
        <button
          onClick={() => { setEditingTemplate(undefined); setEditorOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Neue Vorlage
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-700 font-medium">✕</button>
        </div>
      )}

      {/* Tabelle */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Lädt…</div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-base font-medium text-gray-900">Noch keine Vorlagen</p>
            <p className="mt-1 text-sm text-gray-500">Klicken Sie auf „Neue Vorlage" um zu beginnen.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Briefpapier</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Erstellt</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {t.letterheadPath ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.letterheadPath}
                          alt="Briefpapier Vorschau"
                          className="h-10 w-8 rounded border border-gray-200 object-cover"
                        />
                        <button
                          onClick={() => handleRemoveLetterhead(t.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                          title="Briefpapier entfernen"
                        >
                          <ImageOff className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          activeUploadId.current = t.id;
                          letterheadInputRef.current?.click();
                        }}
                        disabled={uploadingId === t.id}
                        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingId === t.id ? 'Lädt hoch…' : 'Hochladen'}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditingTemplate(t); setEditorOpen(true); }}
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        title="Bearbeiten"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {deleteConfirm === t.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Löschen
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Abbrechen
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(t.id)}
                          className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Verstecktes File-Input für Briefpapier-Upload */}
      <input
        ref={letterheadInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const id = activeUploadId.current;
          if (file && id) handleLetterheadUpload(file, id);
          e.target.value = '';
        }}
      />

      {/* Template-Editor-Modal */}
      <TemplateEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSuccess={() => { setEditorOpen(false); fetchTemplates(); }}
        template={editingTemplate}
      />
    </div>
  );
}
