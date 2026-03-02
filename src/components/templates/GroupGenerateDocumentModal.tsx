'use client';

import { useState, useEffect } from 'react';
import { Files, X, Download, CheckCircle, ChevronRight, ChevronLeft, Tag as TagIcon, GripVertical } from 'lucide-react';

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
  employeeFullName: string;
  employeeCity: string | null;
}

/** snake_case/camelCase → lesbares Label */
function keyToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

type Step = 'select' | 'custom-vars' | 'meta';

export default function GroupGenerateDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  employeeId,
  employeeFullName,
  employeeCity,
}: Props) {
  // Schritt-Steuerung
  const [step, setStep] = useState<Step>('select');

  // Schritt 1: Vorlagen
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // Reihenfolge = Dokumentreihenfolge

  // Schritt 2: Custom-Variablen
  const [loadingVars, setLoadingVars] = useState(false);
  /** Map templateId → Liste der Custom-Var-Keys */
  const [templateCustomVars, setTemplateCustomVars] = useState<Record<string, string[]>>({});
  /** Map templateId → Map varKey → value */
  const [customVarValues, setCustomVarValues] = useState<Record<string, Record<string, string>>>({});

  // Schritt 3: Metadaten
  const [title, setTitle] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [signingCity, setSigningCity] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [pageNumbers, setPageNumbers] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Reset beim Öffnen
  useEffect(() => {
    if (!isOpen) return;
    setStep('select');
    setSelectedIds([]);
    setTemplateCustomVars({});
    setCustomVarValues({});
    setTitle('');
    setValidFrom('');
    setExpirationDate('');
    setCompanyName('');
    setSigningCity(employeeCity ?? '');
    setSelectedCategories([]);
    setNewCategoryInput('');
    setPageNumbers(false);
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
  }, [isOpen, employeeCity]);

  // Template an-/abwählen
  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Vorlage in der Reihenfolge nach oben/unten verschieben
  const moveTemplate = (index: number, direction: -1 | 1) => {
    const newIds = [...selectedIds];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    setSelectedIds(newIds);
  };

  // Kategorien
  const handleAddCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selectedCategories.includes(trimmed)) return;
    setSelectedCategories((prev) => [...prev, trimmed]);
    setNewCategoryInput('');
  };
  const handleRemoveCategory = (name: string) =>
    setSelectedCategories((prev) => prev.filter((c) => c !== name));

  // Custom-Var-Wert setzen (mit Propagation bei geteilten Keys)
  const setVarValue = (templateId: string, key: string, value: string) => {
    setCustomVarValues((prev) => {
      const next = { ...prev };
      next[templateId] = { ...(next[templateId] ?? {}), [key]: value };
      return next;
    });
  };

  // Geteilten Var-Wert in alle Templates mit diesem Key schreiben
  const setSharedVarValue = (key: string, value: string) => {
    setCustomVarValues((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) {
        if (templateCustomVars[id]?.includes(key)) {
          next[id] = { ...(next[id] ?? {}), [key]: value };
        }
      }
      return next;
    });
  };

  // Schritt 1 → Weiter
  const handleNext = async () => {
    if (selectedIds.length === 0) {
      setError('Bitte mindestens eine Vorlage auswählen');
      return;
    }
    setError(null);

    // Custom-Vars für alle gewählten Templates laden
    setLoadingVars(true);
    try {
      const results = await Promise.all(
        selectedIds.map((id) => fetch(`/api/templates/${id}`).then((r) => r.json()))
      );
      const newCustomVars: Record<string, string[]> = {};
      const newValues: Record<string, Record<string, string>> = {};
      results.forEach((data, i) => {
        const id = selectedIds[i];
        const keys: string[] = data.customVariables ?? [];
        newCustomVars[id] = keys;
        newValues[id] = Object.fromEntries(keys.map((k) => [k, customVarValues[id]?.[k] ?? '']));
      });
      setTemplateCustomVars(newCustomVars);
      setCustomVarValues(newValues);

      // Titel vorausfüllen wenn noch leer
      if (!title && selectedIds[0]) {
        const firstTemplate = templates.find((t) => t.id === selectedIds[0]);
        if (firstTemplate) setTitle(firstTemplate.name);
      }

      const hasAnyCustomVars = Object.values(newCustomVars).some((keys) => keys.length > 0);
      setStep(hasAnyCustomVars ? 'custom-vars' : 'meta');
    } catch {
      setError('Vorlagen-Variablen konnten nicht geladen werden');
    } finally {
      setLoadingVars(false);
    }
  };

  // Generieren
  const handleGenerate = async () => {
    if (!companyName.trim()) {
      setError('Firmenname ist erforderlich');
      return;
    }

    setLoading(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const res = await fetch('/api/documents/group-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          templateIds: selectedIds,
          customVariables: customVarValues,
          title: title.trim() || undefined,
          categories: selectedCategories,
          validFrom: validFrom || undefined,
          expirationDate: expirationDate || undefined,
          companyName: companyName.trim(),
          signingCity: signingCity.trim(),
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

  const hasAnyCustomVars = selectedIds.some((id) => (templateCustomVars[id] ?? []).length > 0);
  const totalSteps = hasAnyCustomVars ? 3 : 2;
  const currentStepNum = step === 'select' ? 1 : step === 'custom-vars' ? 2 : totalSteps;

  // Geteilte Keys (in >1 Template vorhanden)
  const allVarEntries: Record<string, string[]> = {}; // key → list of templateIds using it
  for (const id of selectedIds) {
    for (const key of templateCustomVars[id] ?? []) {
      allVarEntries[key] = [...(allVarEntries[key] ?? []), id];
    }
  }
  const sharedKeys = Object.keys(allVarEntries).filter((k) => allVarEntries[k].length > 1);
  const sharedKeySet = new Set(sharedKeys);

  const selectedTemplates = selectedIds.map((id) => templates.find((t) => t.id === id)).filter(Boolean) as Template[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
              <Files className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Dokumentengruppe erstellen</h2>
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
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Erfolgsstatus */}
          {downloadUrl && (
            <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Dokumentengruppe erfolgreich erstellt!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Das Dokument wurde in der Mitarbeiterliste gespeichert.
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

          {/* ── Schritt 1: Vorlagen auswählen ── */}
          {!downloadUrl && step === 'select' && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Vorlagen auswählen <span className="text-red-500">*</span>
                </p>
                <p className="mb-3 text-xs text-gray-500">
                  Die Reihenfolge der Auswahl bestimmt die Dokumentenreihenfolge im PDF.
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
                    {templates.map((t) => {
                      const isSelected = selectedIds.includes(t.id);
                      const orderIndex = selectedIds.indexOf(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTemplate(t.id)}
                          className={`w-full rounded-lg border px-4 py-3 text-left transition-colors flex items-start gap-3 ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{t.name}</p>
                            {t.description && (
                              <p className="mt-0.5 text-xs text-gray-500 truncate">{t.description}</p>
                            )}
                          </div>
                          {isSelected && (
                            <span className="ml-auto shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                              {orderIndex + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ausgewählte Reihenfolge anzeigen + umsortieren */}
              {selectedIds.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Reihenfolge im Vertrag
                  </p>
                  <div className="space-y-1.5">
                    {selectedTemplates.map((t, i) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                        <span className="text-xs font-bold text-primary-600 w-4 shrink-0">{i + 1}.</span>
                        <span className="flex-1 text-sm text-gray-800 truncate">{t.name}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveTemplate(i, -1); }}
                            disabled={i === 0}
                            className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-25"
                            title="Nach oben"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); moveTemplate(i, 1); }}
                            disabled={i === selectedIds.length - 1}
                            className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-25"
                            title="Nach unten"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Schritt 2: Custom-Variablen ── */}
          {!downloadUrl && step === 'custom-vars' && (
            <div className="space-y-4">
              {sharedKeys.length > 0 && (
                <div>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-3">
                    <p className="text-sm font-medium text-blue-900">Geteilte Angaben</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Diese Felder werden in mehreren Vorlagen verwendet und nur einmal eingegeben.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {sharedKeys.map((key) => {
                      // Wert aus erstem Template das diesen Key hat
                      const firstOwner = allVarEntries[key][0];
                      const value = customVarValues[firstOwner]?.[key] ?? '';
                      return (
                        <div key={key}>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {keyToLabel(key)}
                            <span className="ml-1.5 text-xs font-normal text-gray-400">{`{{${key}}}`}</span>
                          </label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setSharedVarValue(key, e.target.value)}
                            placeholder={`Wert für {{${key}}}`}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedIds.map((id) => {
                const template = templates.find((t) => t.id === id);
                const uniqueKeys = (templateCustomVars[id] ?? []).filter((k) => !sharedKeySet.has(k));
                if (!template || uniqueKeys.length === 0) return null;
                return (
                  <div key={id}>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-3">
                      <p className="text-sm font-medium text-amber-900">Pflichtangaben für „{template.name}"</p>
                    </div>
                    <div className="space-y-3">
                      {uniqueKeys.map((key) => (
                        <div key={key}>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {keyToLabel(key)}
                            <span className="ml-1.5 text-xs font-normal text-gray-400">{`{{${key}}}`}</span>
                          </label>
                          <input
                            type="text"
                            value={customVarValues[id]?.[key] ?? ''}
                            onChange={(e) => setVarValue(id, key, e.target.value)}
                            placeholder={`Wert für {{${key}}}`}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Schritt 3: Metadaten ── */}
          {!downloadUrl && step === 'meta' && (
            <div className="space-y-3">
              {/* Zusammenfassung der gewählten Vorlagen */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 space-y-1">
                {selectedTemplates.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="font-bold text-primary-600 w-5 shrink-0">{i + 1}.</span>
                    <span className="text-gray-800">{t.name}</span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-1.5">+ Automatische Zusammenfassungsseite</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Dokumenttitel</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Wird automatisch aus erster Vorlage übernommen"
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
                <span className="text-sm text-gray-700">Seitennummerierung (unten rechts, durchlaufend)</span>
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Firma (Arbeitgeber) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="z.B. Schendel GmbH"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ort (für Unterschriftzeile)</label>
                <input
                  type="text"
                  value={signingCity}
                  onChange={(e) => setSigningCity(e.target.value)}
                  placeholder="z.B. Moers"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

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
                {availableCategories.filter(
                  (c) => !selectedCategories.some((s) => s.toLowerCase() === c.name.toLowerCase())
                ).length > 0 && (
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
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 shrink-0">
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
                onClick={() => { setStep(hasAnyCustomVars ? 'custom-vars' : 'select'); setError(null); }}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Zurück
              </button>
            )}
          </div>

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
                disabled={selectedIds.length === 0 || loadingVars}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {loadingVars ? 'Lädt…' : 'Weiter'}
                {!loadingVars && <ChevronRight className="h-4 w-4" />}
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
                <Files className="h-4 w-4" />
                {loading ? 'Wird generiert…' : 'Generieren & Speichern'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
