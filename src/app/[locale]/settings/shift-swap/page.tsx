'use client';

import { useState } from 'react';
import { ArrowLeftRight, Check, AlertCircle, Info } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { clsx } from 'clsx';

type ShiftSwapMode = 'allowed' | 'approval_required' | 'forbidden';

interface Option {
  value: ShiftSwapMode;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

export default function ShiftSwapSettingsPage() {
  const { settings, isLoading, updateShiftSwapMode } = useSystemSettings();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentMode = settings?.shiftSwap?.mode || 'allowed';

  const options: Option[] = [
    {
      value: 'allowed',
      title: 'Schichttausch zulassen',
      description: 'Mitarbeiter können Schichten frei untereinander tauschen. Tauschanfragen werden automatisch akzeptiert.',
      icon: '✓',
      color: 'green',
    },
    {
      value: 'approval_required',
      title: 'Schichttausch nach Genehmigung',
      description: 'Mitarbeiter können Tauschanfragen stellen, aber diese müssen von einem Admin genehmigt werden.',
      icon: '⏳',
      color: 'yellow',
    },
    {
      value: 'forbidden',
      title: 'Schichttausch verbieten',
      description: 'Schichttausch ist komplett deaktiviert. Der Menüpunkt wird ausgeblendet und keine Tauschfunktionen sind verfügbar.',
      icon: '✕',
      color: 'red',
    },
  ];

  const handleSelect = async (mode: ShiftSwapMode) => {
    if (mode === currentMode) return;

    setSaving(true);
    setMessage(null);

    const success = await updateShiftSwapMode(mode);

    if (success) {
      setMessage({ type: 'success', text: 'Einstellung wurde gespeichert.' });
    } else {
      setMessage({ type: 'error', text: 'Fehler beim Speichern der Einstellung.' });
    }

    setSaving(false);

    // Clear message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schichttausch Einstellungen</h1>
            <p className="text-sm text-gray-600">
              Verwalten Sie die Schichttausch-Funktionalität für alle Mitarbeiter
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p>
            <strong>Hinweis:</strong> Diese Einstellung gilt für alle Mitarbeiter im System. 
            Bei "Verbieten" wird der Menüpunkt "Schichttausch" komplett ausgeblendet.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-4">
        {options.map((option) => {
          const isSelected = currentMode === option.value;
          const isForbidden = option.value === 'forbidden';

          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              disabled={saving}
              className={clsx(
                'w-full text-left p-6 rounded-lg border-2 transition-all',
                isSelected
                  ? `border-${option.color}-500 bg-${option.color}-50 dark:bg-${option.color}-900/20`
                  : 'border-gray-200 hover:border-gray-300 bg-white',
                saving && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Radio Circle */}
                <div
                  className={clsx(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                    isSelected
                      ? `border-${option.color}-500 bg-${option.color}-500`
                      : 'border-gray-300'
                  )}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{option.icon}</span>
                    <h3 className={clsx(
                      'text-lg font-semibold',
                      isSelected ? `text-${option.color}-700` : 'text-gray-900'
                    )}>
                      {option.title}
                    </h3>
                  </div>
                  <p className={clsx(
                    'mt-2 text-sm',
                    isSelected ? `text-${option.color}-600` : 'text-gray-600'
                  )}>
                    {option.description}
                  </p>

                  {/* Warning for forbidden */}
                  {isForbidden && isSelected && (
                    <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Der Schichttausch-Menüpunkt wird ausgeblendet</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={clsx(
            'p-4 rounded-lg flex items-center gap-2',
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          )}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Current Status */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Aktuelle Einstellung</h4>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{options.find((o) => o.value === currentMode)?.icon}</span>
          <span className="font-medium text-gray-900">
            {options.find((o) => o.value === currentMode)?.title}
          </span>
        </div>
      </div>
    </div>
  );
}
