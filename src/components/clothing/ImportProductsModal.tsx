'use client';

import { useState } from 'react';
import { Download, X, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ productId: number; error: string }>;
  message: string;
}

export default function ImportProductsModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportProductsModalProps) {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('publish');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    setImporting(true);
    setResult(null);

    try {
      const response = await fetch('/api/woocommerce/import-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category || undefined,
          status: status || 'publish',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import fehlgeschlagen');
      }

      const data = await response.json();
      setResult(data);

      if (data.success && data.imported + data.updated > 0) {
        onSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
      setResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{ productId: 0, error: error instanceof Error ? error.message : 'Unbekannter Fehler' }],
        message: 'Import fehlgeschlagen',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setCategory('');
    setStatus('publish');
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center space-x-3">
              <Download className="h-6 w-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Artikel aus WooCommerce importieren
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {!result ? (
              <div className="space-y-4">
                {/* Info Box */}
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Hinweise zum Import:</p>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        <li>Artikel werden anhand der SKU zugeordnet</li>
                        <li>Bestehende Artikel werden aktualisiert</li>
                        <li>Größen werden aus Produkt-Attributen extrahiert</li>
                        <li>Die erste Kategorie wird übernommen</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Filter Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kategorie (optional)
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="z.B. Oberbekleidung"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leer lassen um alle Kategorien zu importieren
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Produkt-Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    >
                      <option value="publish">Veröffentlicht</option>
                      <option value="draft">Entwurf</option>
                      <option value="any">Alle Status</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Result Summary */}
                <div className={`rounded-lg p-4 border ${
                  result.success && result.errors.length === 0
                    ? 'bg-green-50 border-green-200'
                    : result.success && result.errors.length > 0
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start">
                    {result.success && result.errors.length === 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                    ) : result.success && result.errors.length > 0 ? (
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{result.message}</p>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                    <p className="text-sm text-gray-600">Neu importiert</p>
                    <p className="mt-1 text-2xl font-semibold text-green-600">
                      {result.imported}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                    <p className="text-sm text-gray-600">Aktualisiert</p>
                    <p className="mt-1 text-2xl font-semibold text-blue-600">
                      {result.updated}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                    <p className="text-sm text-gray-600">Übersprungen</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-600">
                      {result.skipped}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                    <p className="text-sm text-gray-600">Fehler</p>
                    <p className="mt-1 text-2xl font-semibold text-red-600">
                      {result.errors.length}
                    </p>
                  </div>
                </div>

                {/* Error Log */}
                {result.errors.length > 0 && (
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Fehler-Details:
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {result.errors.map((err, idx) => (
                        <div
                          key={idx}
                          className="rounded bg-white p-2 text-sm border border-gray-200"
                        >
                          <span className="font-medium text-gray-700">
                            Produkt #{err.productId}:
                          </span>{' '}
                          <span className="text-red-600">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 border-t border-gray-200 px-6 py-4">
            {!result ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Importiere...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Jetzt importieren</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Schließen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
