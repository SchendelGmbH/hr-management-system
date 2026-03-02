'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Upload, ImageOff, FileText, Save } from 'lucide-react';
import TemplateEditorModal from '@/components/templates/TemplateEditorModal';

interface Template {
  id: string;
  name: string;
  description: string | null;
  content: string;
  createdAt: string;
}

interface PdfSettings {
  letterheadPath: string | null;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PDF-Einstellungen
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>({ letterheadPath: null, marginTop: 40, marginBottom: 20, marginLeft: 25, marginRight: 25 });
  const [marginTop, setMarginTop] = useState<string>('40');
  const [marginBottom, setMarginBottom] = useState<string>('20');
  const [marginLeft, setMarginLeft] = useState<string>('25');
  const [marginRight, setMarginRight] = useState<string>('25');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [letterheadUploading, setLetterheadUploading] = useState(false);
  const letterheadInputRef = useRef<HTMLInputElement>(null);

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

  const fetchPdfSettings = async () => {
    try {
      const res = await fetch('/api/settings/pdf');
      if (!res.ok) return;
      const data: PdfSettings = await res.json();
      setPdfSettings(data);
      setMarginTop(String(data.marginTop));
      setMarginBottom(String(data.marginBottom));
      setMarginLeft(String(data.marginLeft));
      setMarginRight(String(data.marginRight));
    } catch {
      // still load page silently
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPdfSettings();
  }, []);

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

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(false);
    try {
      const res = await fetch('/api/settings/pdf', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marginTop: Number(marginTop),
          marginBottom: Number(marginBottom),
          marginLeft: Number(marginLeft),
          marginRight: Number(marginRight),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSettingsError(data.error || 'Speichern fehlgeschlagen');
        return;
      }
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 2500);
      fetchPdfSettings();
    } catch {
      setSettingsError('Netzwerkfehler');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLetterheadUpload = async (file: File) => {
    setLetterheadUploading(true);
    setSettingsError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/settings/pdf/letterhead', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        setSettingsError(data.error || 'Upload fehlgeschlagen');
        return;
      }
      fetchPdfSettings();
    } catch {
      setSettingsError('Netzwerkfehler');
    } finally {
      setLetterheadUploading(false);
    }
  };

  const handleRemoveLetterhead = async () => {
    setSettingsError(null);
    try {
      await fetch('/api/settings/pdf/letterhead', { method: 'DELETE' });
      fetchPdfSettings();
    } catch {
      setSettingsError('Netzwerkfehler');
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

      {/* PDF-Standardeinstellungen */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">PDF-Standardeinstellungen</h2>

        {settingsError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {settingsError}
            <button onClick={() => setSettingsError(null)} className="ml-3 text-red-500 hover:text-red-700 font-medium">✕</button>
          </div>
        )}

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Briefpapier */}
          <div className="flex-shrink-0">
            <p className="text-sm font-medium text-gray-700 mb-2">Briefpapier</p>
            {pdfSettings.letterheadPath ? (
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pdfSettings.letterheadPath}
                  alt="Briefpapier Vorschau"
                  className="w-20 rounded border border-gray-200 object-cover shadow-sm"
                  style={{ aspectRatio: '1 / 1.414' }}
                />
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => letterheadInputRef.current?.click()}
                    disabled={letterheadUploading}
                    className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Ersetzen
                  </button>
                  <button
                    onClick={handleRemoveLetterhead}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
                  >
                    <ImageOff className="h-3.5 w-3.5" />
                    Entfernen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => letterheadInputRef.current?.click()}
                disabled={letterheadUploading}
                className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 disabled:opacity-50 transition-colors"
              >
                <Upload className="h-4 w-4" />
                {letterheadUploading ? 'Lädt hoch…' : 'PNG oder JPG hochladen'}
              </button>
            )}
            <input
              ref={letterheadInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLetterheadUpload(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Trennlinie */}
          <div className="hidden sm:block w-px bg-gray-200 self-stretch" />

          {/* Ränder */}
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-gray-700">Inhaltsbereich</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Abstand oben</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={marginTop}
                    onChange={(e) => setMarginTop(e.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-400">mm</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Abstand unten</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={marginBottom}
                    onChange={(e) => setMarginBottom(e.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-400">mm</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Abstand links</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={marginLeft}
                    onChange={(e) => setMarginLeft(e.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-400">mm</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Abstand rechts</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={marginRight}
                    onChange={(e) => setMarginRight(e.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-400">mm</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {settingsSaving ? 'Speichert…' : 'Speichern'}
              </button>
              {settingsSuccess && (
                <span className="text-sm text-green-600 font-medium">Gespeichert ✓</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vorlagen-Tabelle */}
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
