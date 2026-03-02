'use client';

import { useState, useEffect } from 'react';
import { FileText, X, Download, CheckCircle, ChevronRight, ChevronLeft, Tag as TagIcon } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeId: string;
  /** Wenn gesetzt → neue Version für dieses Dokument-Container statt neuem Dokument */
  parentDocumentId?: string;
  parentDocumentTitle?: string;
}

/** Macht aus einem snake_case/camelCase-Key ein lesbares Label */
function keyToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

type Step = 'select' | 'custom-vars' | 'meta';

export default function GenerateDocumentModal({ isOpen, onClose, onSuccess, employeeId, parentDocumentId, parentDocumentTitle }: Props) {
  const isNewVersion = !!parentDocumentId;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customVarKeys, setCustomVarKeys] = useState<string[]>([]);
  const [customVarValues, setCustomVarValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [pageNumbers, setPageNumbers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingVars, setLoadingVars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTemplate(null);
    setCustomVarKeys([]);
    setCustomVarValues({});
    setTitle(parentDocumentTitle ?? '');
    setValidFrom('');
    setExpirationDate('');
    setSelectedCategories([]);
    setNewCategoryInput('');
    setPageNumbers(false);
    setStep('select');
    setError(null);
    setDownloadUrl(null);

    setLoadingTemplates(true);
    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setError('Vorlagen konnten nicht geladen werden'))
      .finally(() => setLoadingTemplates(false));

    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setAvailableCategories(data.categories ?? []))
      .catch(() => {});
  }, [isOpen]);

  const handleAddCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selectedCategories.includes(trimmed)) return;
    setSelectedCategories((prev) => [...prev, trimmed]);
    setNewCategoryInput('');
  };

  const handleRemoveCategory = (name: string) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== name));
  };

  const handleSelectTemplate = async (t: Template) => {
    setSelectedTemplate(t);
    if (!title && !isNewVersion) setTitle(t.name);
    setError(null);

    // Custom-Variablen des Templates laden
    setLoadingVars(true);
    try {
      const res = await fetch(`/api/templates/${t.id}`);
      const data = await res.json();
      const keys: string[] = data.customVariables ?? [];
      setCustomVarKeys(keys);
      setCustomVarValues(Object.fromEntries(keys.map((k) => [k, ''])));
    } catch {
      setCustomVarKeys([]);
      setCustomVarValues({});
    } finally {
      setLoadingVars(false);
    }
  };

  const handleNext = () => {
    if (!selectedTemplate) { setError('Bitte eine Vorlage auswählen'); return; }
    setError(null);
    if (customVarKeys.length > 0) {
      setStep('custom-vars');
    } else {
      setStep('meta');
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          title: title.trim() || undefined,
          categories: selectedCategories,
          validFrom: validFrom || undefined,
          expirationDate: expirationDate || undefined,
          customVariables: customVarValues,
          parentDocumentId: parentDocumentId || undefined,
          pageNumbers,
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

  const totalSteps = customVarKeys.length > 0 ? 3 : 2;
  const currentStepNum = step === 'select' ? 1 : step === 'custom-vars' ? 2 : totalSteps;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
              <FileText className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
              {isNewVersion ? 'Neue Version aus Vorlage' : 'Dokument aus Vorlage'}
            </h2>
              {!downloadUrl && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Schritt {currentStepNum} von {totalSteps}
                </p>
              )}
            </div>
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
                <p className="text-sm font-medium text-green-900">
                  {isNewVersion ? 'Neue Version erfolgreich erstellt!' : 'Dokument erfolgreich erstellt!'}
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  {isNewVersion
                    ? 'Die neue Version wurde dem Dokument hinzugefügt.'
                    : 'Das Dokument wurde in der Mitarbeiterliste gespeichert.'}
                </p>
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

          {/* Schritt 1: Vorlage auswählen */}
          {!downloadUrl && step === 'select' && (
            <div>
              {isNewVersion && (
                <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                  <p className="text-sm font-medium text-blue-900">Neue Version erstellen</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Das generierte PDF wird als neue Version zu <span className="font-medium">„{parentDocumentTitle}"</span> hinzugefügt.
                  </p>
                </div>
              )}
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
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTemplate(t)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                        selectedTemplate?.id === t.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {loadingVars && selectedTemplate && (
                <p className="mt-2 text-xs text-gray-400">Vorlage wird analysiert…</p>
              )}
            </div>
          )}

          {/* Schritt 2: Custom-Variablen eingeben */}
          {!downloadUrl && step === 'custom-vars' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm font-medium text-amber-900">Pflichtangaben für diese Vorlage</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Die folgenden Werte sind in „{selectedTemplate?.name}" definiert und werden in das Dokument eingesetzt.
                </p>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {customVarKeys.map((key) => (
                  <div key={key}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {keyToLabel(key)}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">{`{{${key}}}`}</span>
                    </label>
                    <input
                      type="text"
                      value={customVarValues[key] ?? ''}
                      onChange={(e) =>
                        setCustomVarValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={`Wert für {{${key}}}`}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schritt 3 / letzter Schritt: Metadaten */}
          {!downloadUrl && step === 'meta' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
                Vorlage: <span className="font-medium text-gray-900">{selectedTemplate?.name}</span>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Dokumenttitel</label>
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
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pageNumbers}
                  onChange={(e) => setPageNumbers(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Seitennummerierung (unten rechts)</span>
              </label>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <TagIcon className="inline h-4 w-4 mr-1" />
                  Kategorien
                </label>
                {selectedCategories.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedCategories.map((cat) => {
                      const existing = availableCategories.find(
                        (c) => c.name.toLowerCase() === cat.toLowerCase()
                      );
                      const color = existing?.color || '#3B82F6';
                      return (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat)}
                            className="rounded-full hover:opacity-70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(newCategoryInput); }
                    }}
                    placeholder="Kategorie eingeben…"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCategory(newCategoryInput)}
                    disabled={!newCategoryInput.trim()}
                    className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    Hinzufügen
                  </button>
                </div>
                {availableCategories.filter((c) => !selectedCategories.some((s) => s.toLowerCase() === c.name.toLowerCase())).length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1.5 text-xs text-gray-500">Aus bestehenden wählen:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCategories
                        .filter((c) => !selectedCategories.some((s) => s.toLowerCase() === c.name.toLowerCase()))
                        .map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleAddCategory(cat.name)}
                            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <span
                              className="mr-1.5 h-2 w-2 rounded-full"
                              style={{ backgroundColor: cat.color || '#3B82F6' }}
                            />
                            {cat.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          {/* Zurück */}
          <div>
            {step === 'custom-vars' && (
              <button
                onClick={() => { setStep('select'); setError(null); }}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </button>
            )}
            {step === 'meta' && (
              <button
                onClick={() => { setStep(customVarKeys.length > 0 ? 'custom-vars' : 'select'); setError(null); }}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </button>
            )}
          </div>

          {/* Rechte Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {downloadUrl ? 'Schließen' : 'Abbrechen'}
            </button>

            {!downloadUrl && step === 'select' && (
              <button
                onClick={handleNext}
                disabled={!selectedTemplate || loadingVars}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Weiter
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {!downloadUrl && step === 'custom-vars' && (
              <button
                onClick={() => { setStep('meta'); setError(null); }}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Weiter
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {!downloadUrl && step === 'meta' && (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {loading ? 'Wird generiert…' : 'Generieren & Speichern'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
