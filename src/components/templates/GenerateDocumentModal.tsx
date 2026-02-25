'use client';

import { useState, useEffect } from 'react';
import { FileText, X, Download, CheckCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  letterheadPath: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: string;
}

export default function GenerateDocumentModal({ isOpen, onClose, onSuccess, employeeId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [categories, setCategories] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setTitle('');
    setValidFrom('');
    setExpirationDate('');
    setCategories('');
    setError(null);
    setDownloadUrl(null);

    setLoadingTemplates(true);
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setError('Vorlagen konnten nicht geladen werden'))
      .finally(() => setLoadingTemplates(false));
  }, [isOpen]);

  const handleSelectTemplate = (t: Template) => {
    setSelectedId(t.id);
    if (!title) setTitle(t.name);
  };

  const handleGenerate = async () => {
    if (!selectedId) { setError('Bitte eine Vorlage auswählen'); return; }

    setLoading(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const categoryList = categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch(`/api/templates/${selectedId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          title: title.trim() || undefined,
          categories: categoryList,
          validFrom: validFrom || undefined,
          expirationDate: expirationDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Generierung fehlgeschlagen');
        return;
      }

      const data = await res.json();
      setDownloadUrl(data.downloadUrl);
      onSuccess();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
              <FileText className="h-5 w-5 text-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Dokument aus Vorlage</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Erfolgsstatus */}
          {downloadUrl && (
            <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Dokument erfolgreich erstellt!</p>
                <p className="text-xs text-green-700 mt-0.5">Das Dokument wurde in der Mitarbeiterliste gespeichert.</p>
              </div>
              <a
                href={downloadUrl}
                download
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <Download className="h-3.5 w-3.5" />
                PDF öffnen
              </a>
            </div>
          )}

          {/* Vorlagen-Auswahl */}
          {!downloadUrl && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Vorlage auswählen <span className="text-red-500">*</span>
                </p>
                {loadingTemplates ? (
                  <p className="text-sm text-gray-500">Lädt…</p>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Noch keine Vorlagen vorhanden. Bitte zuerst unter{' '}
                    <span className="font-medium">Einstellungen → Dokumentvorlagen</span> eine Vorlage anlegen.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTemplate(t)}
                        className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                          selectedId === t.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{t.name}</p>
                          <span
                            className={`text-xs ${
                              t.letterheadPath ? 'text-green-600' : 'text-gray-400'
                            }`}
                          >
                            {t.letterheadPath ? '✓ Briefpapier' : 'Kein Briefpapier'}
                          </span>
                        </div>
                        {t.description && (
                          <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Optionale Felder */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Dokumenttitel
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Wird automatisch aus Vorlage übernommen"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Gültig ab</label>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Ablaufdatum</label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Kategorien{' '}
                    <span className="text-xs font-normal text-gray-500">(kommagetrennt)</span>
                  </label>
                  <input
                    type="text"
                    value={categories}
                    onChange={(e) => setCategories(e.target.value)}
                    placeholder="z.B. Vertrag, Arbeitsvertrag"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {downloadUrl ? 'Schließen' : 'Abbrechen'}
          </button>
          {!downloadUrl && (
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedId}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {loading ? 'Wird generiert…' : 'Generieren & Speichern'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
