'use client';

import { useState } from 'react';
import { Download, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function WooCommerceImportPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Filter-States
  const [statusFilter, setStatusFilter] = useState('completed,processing');
  const [afterDate, setAfterDate] = useState('');
  const [beforeDate, setBeforeDate] = useState('');

  const handleImport = async () => {
    setImporting(true);
    setResult(null);

    try {
      const response = await fetch('/api/woocommerce/import-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusFilter,
          after: afterDate || undefined,
          before: beforeDate || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Import failed');
      }

      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          WooCommerce Bestellungen importieren
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Importiere Bestellungen aus dem WooCommerce-Shop in das HR-System
        </p>
      </div>

      {/* Import Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            >
              <option value="completed">Nur abgeschlossene (completed)</option>
              <option value="processing">Nur in Bearbeitung (processing)</option>
              <option value="completed,processing">Abgeschlossen + In Bearbeitung</option>
              <option value="on-hold">Nur pausiert (on-hold)</option>
              <option value="completed,processing,on-hold">Alle aktiven</option>
            </select>
          </div>

          {/* After Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Von Datum (optional)
            </label>
            <input
              type="date"
              value={afterDate}
              onChange={(e) => setAfterDate(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>

          {/* Before Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bis Datum (optional)
            </label>
            <input
              type="date"
              value={beforeDate}
              onChange={(e) => setBeforeDate(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Import Button */}
        <div className="mt-6">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center space-x-2 rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-5 w-5" />
            <span>{importing ? 'Importiere...' : 'Bestellungen importieren'}</span>
          </button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div
          className={`rounded-lg border p-6 ${
            result.success
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-start">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-green-600 mr-3 flex-shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {result.success ? 'Import erfolgreich' : 'Import fehlgeschlagen'}
              </h3>

              {result.message && (
                <p className="text-sm text-gray-700 mb-4">{result.message}</p>
              )}

              {result.imported !== undefined && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-gray-600">Importiert</p>
                    <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-gray-600">Übersprungen</p>
                    <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs text-gray-600">Fehler</p>
                    <p className="text-2xl font-bold text-red-600">
                      {result.errors?.length || 0}
                    </p>
                  </div>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    Fehler-Details:
                  </h4>
                  <div className="space-y-2">
                    {result.errors.map((err: any, idx: number) => (
                      <div key={idx} className="rounded bg-white p-2 text-xs">
                        <span className="font-mono text-gray-600">
                          Order #{err.orderId}:
                        </span>{' '}
                        <span className="text-red-600">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.error && (
                <div className="mt-2 text-sm text-red-700">
                  <strong>Fehler:</strong> {result.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">Wichtige Hinweise:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Mitarbeiter-Zuordnung erfolgt über Custom Field &quot;woocommerce_customer_id&quot; oder Email
              </li>
              <li>
                Produkte werden über SKU gemappt - SKU muss im Artikel-Katalog vorhanden sein
              </li>
              <li>
                Status &quot;completed&quot; wird als DELIVERED importiert (Budget wird sofort abgezogen!)
              </li>
              <li>
                Duplikate werden automatisch übersprungen (anhand WooCommerce Order ID)
              </li>
              <li>
                Bei Fehlern siehe Fehler-Log und korrigiere Stammdaten (Mitarbeiter/Artikel)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
