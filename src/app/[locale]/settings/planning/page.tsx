'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface PlanningSettings {
  siteRetentionDays: number;
  poolDepartments: string[];
  defaultStartTime: string;
  defaultEndTime: string;
  autoCarryOver: boolean;
  weekendMode: 'none' | 'saturday' | 'both';
}

const INPUT_CLS = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

export default function PlanningSettingsPage() {
  const [settings, setSettings] = useState<PlanningSettings>({
    siteRetentionDays: 30,
    poolDepartments: [],
    defaultStartTime: '06:00',
    defaultEndTime: '16:00',
    autoCarryOver: true,
    weekendMode: 'both',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, deptsRes] = await Promise.all([
          fetch('/api/settings/planning'),
          fetch('/api/departments'),
        ]);
        const settingsData = await settingsRes.json();
        const deptsData = await deptsRes.json();
        setSettings(settingsData);
        setDepartments(deptsData.departments ?? []);
      } catch {
        setError('Fehler beim Laden der Einstellungen');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/settings/planning', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Fehler beim Speichern');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  const toggleDepartment = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      poolDepartments: prev.poolDepartments.includes(id)
        ? prev.poolDepartments.filter((d) => d !== id)
        : [...prev.poolDepartments, id],
    }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/de/settings" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" />
        Einstellungen
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tagesplanung</h1>
          <p className="mt-1 text-sm text-gray-600">Einstellungen für die Tagesplanung</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Speichert…' : saved ? 'Gespeichert ✓' : 'Speichern'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="max-w-2xl space-y-6">

        {/* Automatische Übernahme */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Automatische Übernahme vom Vortag</h2>
          <p className="mt-1 text-sm text-gray-500">
            Wenn noch kein Plan für den gewählten Tag existiert, wird der Vortag als Vorlage geladen.
          </p>
          <div className="mt-4 flex gap-6">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="autoCarryOver"
                checked={settings.autoCarryOver}
                onChange={() => setSettings((prev) => ({ ...prev, autoCarryOver: true }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Ja</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="autoCarryOver"
                checked={!settings.autoCarryOver}
                onChange={() => setSettings((prev) => ({ ...prev, autoCarryOver: false }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Nein</span>
            </label>
          </div>
        </div>

        {/* Wochenenden berücksichtigen */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Wochenenden bei Übernahme berücksichtigen</h2>
          <p className="mt-1 text-sm text-gray-500">
            Legt fest, welche Wochentage als Arbeitstage gelten. Wochenendtage und Feiertage werden beim automatischen Übernehmen übersprungen.
          </p>
          <div className="mt-4">
            <select
              value={settings.weekendMode}
              onChange={(e) => setSettings((prev) => ({ ...prev, weekendMode: e.target.value as 'none' | 'saturday' | 'both' }))}
              className={INPUT_CLS}
            >
              <option value="none">Nein – kein Wochenende</option>
              <option value="saturday">Samstag</option>
              <option value="both">Samstag &amp; Sonntag</option>
            </select>
          </div>
        </div>

        {/* Standard-Arbeitszeiten */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Standard-Arbeitszeiten</h2>
          <p className="mt-1 text-sm text-gray-500">
            Vorausgefüllte Zeiten beim Anlegen einer neuen Baustelle.
          </p>
          <div className="mt-4 flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Beginn</label>
              <input
                type="time"
                value={settings.defaultStartTime}
                onChange={(e) => setSettings((prev) => ({ ...prev, defaultStartTime: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
            <span className="pb-2 text-gray-400">–</span>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Ende</label>
              <input
                type="time"
                value={settings.defaultEndTime}
                onChange={(e) => setSettings((prev) => ({ ...prev, defaultEndTime: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>

        {/* Baustellen-Speicherdauer */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Baustellen-Speicherdauer</h2>
          <p className="mt-1 text-sm text-gray-500">
            Stammbaustellen, die länger als die eingestellte Anzahl an Tagen nicht verwendet wurden, werden automatisch entfernt.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={365}
              value={settings.siteRetentionDays}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, siteRetentionDays: Math.max(1, parseInt(e.target.value, 10) || 30) }))
              }
              className={`w-24 ${INPUT_CLS}`}
            />
            <span className="text-sm text-gray-600">Tage</span>
          </div>
        </div>

        {/* Abteilungen im Mitarbeiter-Pool */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Abteilungen im Mitarbeiter-Pool</h2>
          <p className="mt-1 text-sm text-gray-500">
            Nur Mitarbeiter der gewählten Abteilungen erscheinen im Pool der Tagesplanung.
            Ist keine Abteilung ausgewählt, werden alle aktiven Mitarbeiter angezeigt.
          </p>
          <div className="mt-4 space-y-2.5">
            {departments.length === 0 ? (
              <p className="text-sm italic text-gray-400">Keine Abteilungen vorhanden</p>
            ) : (
              departments.map((dept) => (
                <label key={dept.id} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={settings.poolDepartments.includes(dept.id)}
                    onChange={() => toggleDepartment(dept.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{dept.name}</span>
                </label>
              ))
            )}
          </div>
          {settings.poolDepartments.length > 0 && (
            <button
              onClick={() => setSettings((prev) => ({ ...prev, poolDepartments: [] }))}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600"
            >
              Auswahl aufheben (alle Abteilungen anzeigen)
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
