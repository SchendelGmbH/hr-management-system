'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield, LayoutDashboard, Users, Briefcase, Award, Shirt, FileText, Car,
  CalendarDays, Bell, Settings, Loader2, CheckCircle, Save, ChevronRight, ChevronDown
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessLevel = 'none' | 'read' | 'write';
type Role = 'ADMIN' | 'USER' | 'GEWERBLICH' | 'PERSONALER';

interface SavedPermission {
  role: string;
  module: string;
  action: string;
  access: string;
}

interface PermissionState {
  [key: string]: AccessLevel;
}

interface MasterSwitchState {
  [key: string]: AccessLevel | null;
}

// ─── Module Config ────────────────────────────────────────────────────────────

const MODULES: { key: string; label: string; icon: React.ElementType; actions: { action: string; label: string }[] }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, actions: [
      { action: 'view', label: 'Dashboard anzeigen' },
      { action: 'stats', label: 'Statistiken & Übersichten' },
      { action: 'audit', label: 'Audit-Log sehen' },
  ]},
  { key: 'employees', label: 'Mitarbeiter', icon: Users, actions: [
      { action: 'view', label: 'Liste anzeigen' },
      { action: 'details', label: 'Details anzeigen' },
      { action: 'create', label: 'Neuen erstellen' },
      { action: 'edit', label: 'Bearbeiten' },
      { action: 'delete', label: 'Löschen' },
      { action: 'portal', label: 'Portal-Zugang verwalten' },
      { action: 'password', label: 'Passwort zurücksetzen' },
      { action: 'clothing', label: 'Kleidung zuweisen' },
      { action: 'qualifications', label: 'Qualifikationen verwalten' },
  ]},
  { key: 'vacations', label: 'Urlaub', icon: Briefcase, actions: [
      { action: 'view_own', label: 'Eigenen Urlaub anzeigen' },
      { action: 'view_all', label: 'Alle Urlaube anzeigen' },
      { action: 'request', label: 'Urlaub beantragen' },
      { action: 'approve', label: 'Genehmigen/Ablehnen' },
      { action: 'edit', label: 'Bearbeiten' },
      { action: 'delete', label: 'Löschen' },
  ]},
  { key: 'qualifications', label: 'Qualifikationen', icon: Award, actions: [
      { action: 'view', label: 'Anzeigen' },
      { action: 'manage_types', label: 'Typen verwalten' },
      { action: 'create', label: 'Neue erstellen' },
      { action: 'edit', label: 'Bearbeiten' },
      { action: 'delete', label: 'Löschen' },
  ]},
  { key: 'clothing', label: 'Kleidung', icon: Shirt, actions: [
      { action: 'view_items', label: 'Kleidungsstücke anzeigen' },
      { action: 'view_orders', label: 'Bestellungen anzeigen' },
      { action: 'create_order', label: 'Bestellung erstellen' },
      { action: 'approve_order', label: 'Bestellung genehmigen' },
      { action: 'delete_order', label: 'Bestellung löschen' },
      { action: 'create_item', label: 'Kleidungsstück anlegen' },
      { action: 'edit_item', label: 'Kleidungsstück bearbeiten' },
      { action: 'delete_item', label: 'Kleidungsstück löschen' },
  ]},
  { key: 'documents', label: 'Dokumente', icon: FileText, actions: [
      { action: 'view', label: 'Anzeigen' },
      { action: 'upload', label: 'Hochladen' },
      { action: 'download', label: 'Herunterladen' },
      { action: 'edit', label: 'Bearbeiten' },
      { action: 'delete', label: 'Löschen' },
      { action: 'generate', label: 'Generieren' },
      { action: 'group_generate', label: 'Gruppen-Generierung' },
      { action: 'templates', label: 'Vorlagen verwalten' },
      { action: 'categories', label: 'Kategorien verwalten' },
  ]},
  { key: 'vehicles', label: 'Fahrzeuge', icon: Car, actions: [
      { action: 'view', label: 'Liste anzeigen' },
      { action: 'create', label: 'Neues erstellen' },
      { action: 'edit', label: 'Bearbeiten' },
      { action: 'delete', label: 'Löschen' },
  ]},
  { key: 'dailyPlans', label: 'Tagespläne', icon: CalendarDays, actions: [
      { action: 'view', label: 'Anzeigen' },
      { action: 'edit', label: 'Bearbeiten' },
      { action: 'manage_sites', label: 'Stammbaustellen verwalten' },
      { action: 'settings', label: 'Planungseinstellungen' },
  ]},
  { key: 'calendar', label: 'Kalender', icon: CalendarDays, actions: [
      { action: 'view', label: 'Kalender anzeigen' },
      { action: 'add_absence', label: 'Abwesenheit hinzufügen' },
      { action: 'edit_absence', label: 'Abwesenheit bearbeiten' },
      { action: 'delete_absence', label: 'Abwesenheit löschen' },
  ]},
  { key: 'notifications', label: 'Benachrichtigungen', icon: Bell, actions: [
      { action: 'view', label: 'Anzeigen' },
      { action: 'read', label: 'Lesen/als gelesen markieren' },
      { action: 'snooze', label: 'Erinnerungen zurückstellen' },
  ]},
  { key: 'settings', label: 'Einstellungen', icon: Settings, actions: [
      { action: 'departments', label: 'Abteilungen verwalten' },
      { action: 'pay_grades', label: 'Lohngruppen verwalten' },
      { action: 'audit_log', label: 'Audit-Log anzeigen' },
      { action: 'pdf_settings', label: 'PDF-Einstellungen' },
  ]},
];

// ─── Switch Component ────────────────────────────────────────────────────────

const ACCESS_ORDER: AccessLevel[] = ['none', 'read', 'write'];

const SWITCH_LABELS: Record<AccessLevel, string> = {
  none: 'Keine',
  read: 'Lesen',
  write: 'Lesen & Schreiben',
};

const SWITCH_COLORS: Record<AccessLevel, string> = {
  none: 'bg-gray-300',
  read: 'bg-blue-500',
  write: 'bg-green-500',
};

const SWITCH_POSITIONS = [2, 44, 86];

function AccessSwitch({
  access,
  onChange,
}: {
  access: AccessLevel;
  onChange: (direction: 'left' | 'right') => void;
}) {
  const idx = ACCESS_ORDER.indexOf(access);
  const safeIdx = idx < 0 ? 0 : idx;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.querySelector('.switch-track')?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width; // 108
    if (clickX < trackWidth / 3) onChange('left');
    else if (clickX > (trackWidth * 2) / 3) onChange('right');
    else {
      // Middle third: nearest
      let nearestIdx = 0, nearestDist = Infinity;
      for (let i = 0; i < SWITCH_POSITIONS.length; i++) {
        const dist = Math.abs(clickX - (SWITCH_POSITIONS[i] + 10));
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
      }
      const nearest = ACCESS_ORDER[nearestIdx];
      if (nearest !== access) {
        const currentIdx = ACCESS_ORDER.indexOf(access);
        onChange(nearestIdx < currentIdx ? 'left' : 'right');
      }
    }
  }

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center gap-1.5 rounded-full px-1.5 py-1 transition-all duration-200 hover:scale-105 select-none"
      title="Klicken für nächste Stufe"
    >
      <div className={`switch-track relative h-7 w-[108px] rounded-full ${SWITCH_COLORS[access]} transition-colors duration-300`}>
        <div
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md flex items-center justify-center transition-all duration-300"
          style={{ left: SWITCH_POSITIONS[safeIdx] }}
        >
          {access !== 'none' && (
            <CheckCircle className="h-3 w-3 text-white" />
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-between px-1">
          <span className={`text-[9px] font-semibold ${access === 'none' ? 'text-white' : 'text-white/60'}`}>K</span>
          <span className={`text-[9px] font-semibold ${access === 'read' ? 'text-white' : 'text-white/60'}`}>L</span>
          <span className={`text-[9px] font-semibold ${access === 'write' ? 'text-white' : 'text-white/60'}`}>S</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 w-16 text-left leading-tight h-6 flex items-center">
        {SWITCH_LABELS[access]}
      </span>
    </button>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────

function RoleCard({
  role,
  roleLabel,
  description,
  iconBgClass,
  borderClass,
}: {
  role: Role;
  roleLabel: string;
  description: string;
  iconBgClass: string;
  borderClass: string;
}) {
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [masterSwitches, setMasterSwitches] = useState<MasterSwitchState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(MODULES.map(m => m.key)));

  const loadPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions');
      if (!res.ok) throw new Error('Failed to load');
      const data: SavedPermission[] = await res.json();
      const state: PermissionState = {};
      for (const p of data) {
        state[`${p.role}:${p.module}:${p.action}`] = p.access as AccessLevel;
      }
      setPermissions(state);
    } catch {
      setError('Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  function toggleExpand(key: string) {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Get effective access (master overrides individual)
  function getEffectiveAccess(module: string, action: string): AccessLevel {
    const masterKey = `${role}:${module}`;
    const masterAccess = masterSwitches[masterKey];
    if (masterAccess !== null && masterAccess !== undefined) {
      return masterAccess;
    }
    return permissions[`${role}:${module}:${action}`] ?? 'none';
  }

  // Get master switch value for a module
  function getMasterAccess(module: string): AccessLevel | null {
    return masterSwitches[`${role}:${module}`] ?? null;
  }

  // Compute highest access among all actions in a module
  function getModuleHighestAccess(module: string): AccessLevel {
    const moduleActions = MODULES.find(m => m.key === module)?.actions ?? [];
    let highest: AccessLevel = 'none';
    for (const act of moduleActions) {
      const effective = getEffectiveAccess(module, act.action);
      if (effective === 'write') return 'write';
      if (effective === 'read') highest = 'read';
    }
    return highest;
  }

  // Cycle master switch (sets all actions to the new value)
  function cycleMasterAccess(module: string, direction: 'left' | 'right') {
    const current = getModuleHighestAccess(module);
    const idx = ACCESS_ORDER.indexOf(current);
    const safeIdx = idx < 0 ? 0 : idx;
    const next = direction === 'right'
      ? ACCESS_ORDER[(safeIdx + 1) % ACCESS_ORDER.length]
      : ACCESS_ORDER[(safeIdx + ACCESS_ORDER.length - 1) % ACCESS_ORDER.length];

    // Apply to all actions
    const moduleActions = MODULES.find(m => m.key === module)?.actions ?? [];
    setPermissions(prev => {
      const updated = { ...prev };
      for (const act of moduleActions) {
        updated[`${role}:${module}:${act.action}`] = next;
      }
      return updated;
    });
    setMasterSwitches(prev => ({ ...prev, [`${role}:${module}`]: next }));
    setSaved(false);
  }

  // Reset master switch
  function resetMasterSwitch(module: string) {
    setMasterSwitches(prev => {
      const next = { ...prev };
      delete next[`${role}:${module}`];
      return next;
    });
    setSaved(false);
  }

  function cycleAccess(module: string, action: string, direction: 'left' | 'right') {
    const key = `${role}:${module}:${action}`;
    const current = getEffectiveAccess(module, action);
    const idx = ACCESS_ORDER.indexOf(current);
    const safeIdx = idx < 0 ? 0 : idx;
    const next = direction === 'right'
      ? ACCESS_ORDER[(safeIdx + 1) % ACCESS_ORDER.length]
      : ACCESS_ORDER[(safeIdx + ACCESS_ORDER.length - 1) % ACCESS_ORDER.length];

    const masterKey = `${role}:${module}`;
    const hasMaster = masterSwitches[masterKey] !== null && masterSwitches[masterKey] !== undefined;

    if (hasMaster) {
      // Break out of master: clear master switch, set only this action
      setMasterSwitches(prev => {
        const next2 = { ...prev };
        delete next2[masterKey];
        return next2;
      });
      setPermissions(prev => ({ ...prev, [key]: next }));
    } else {
      setPermissions(prev => ({ ...prev, [key]: next }));
    }
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const items = Object.entries(permissions)
        .filter(([k]) => k.startsWith(`${role}:`))
        .map(([key, access]) => {
          const [, module, action] = key.split(':');
          return { role, module, action, access };
        });
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-xl border-2 ${borderClass} bg-white shadow-sm overflow-hidden`}>
      <div className={`px-6 py-4 border-b border-gray-100 ${iconBgClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${iconBgClass}`}>
              <Shield className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{roleLabel}</h2>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              saved ? 'bg-green-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? '...' : saved ? 'OK' : 'Speichern'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="space-y-5">
            {MODULES.map(mod => {
              const Icon = mod.icon;
              const isExpanded = expandedModules.has(mod.key);
              const masterAccess = getMasterAccess(mod.key);
              const highestAccess = getModuleHighestAccess(mod.key);
              const hasMaster = masterAccess !== null && masterAccess !== undefined;

              return (
                <div key={mod.key}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <button
                      onClick={() => toggleExpand(mod.key)}
                      className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-900">{mod.label}</span>
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                      <AccessSwitch
                        access={hasMaster ? masterAccess! : highestAccess}
                        onChange={(dir) => cycleMasterAccess(mod.key, dir)}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 space-y-1.5 mt-1">
                      {mod.actions.map(act => {
                        const effective = getEffectiveAccess(mod.key, act.action);
                        return (
                          <div key={act.action} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{act.label}</span>
                            <AccessSwitch
                              access={effective}
                              onChange={(dir) => cycleAccess(mod.key, act.action, dir)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">
            ← Zurück zu Einstellungen
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Berechtigungsübersicht</h1>
          <p className="mt-2 text-sm text-gray-600">
            Master-Switch pro Kategorie steuert alle Unterpunkte — zeigt höchstes Recht
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stufen:</span>
        {[
          { value: 'none', label: 'Keine', color: 'bg-gray-400' },
          { value: 'read', label: 'Lesen', color: 'bg-blue-500' },
          { value: 'write', label: 'Lesen & Schreiben', color: 'bg-green-500' },
        ].map(opt => (
          <div key={opt.value} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${opt.color}`} />
            <span className="text-xs text-gray-600">{opt.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <RoleCard role="ADMIN" roleLabel="Administrator" description="Voller Zugriff auf alle Module" iconBgClass="bg-orange-100" borderClass="border-orange-200" />
        <RoleCard role="USER" roleLabel="Mitarbeiter" description="Zugriff auf persönliche Daten" iconBgClass="bg-blue-100" borderClass="border-blue-200" />
        <RoleCard role="GEWERBLICH" roleLabel="Gewerbliche" description="Arbeiter mit Zugriff auf Werkzeuge, Fahrzeuge" iconBgClass="bg-yellow-100" borderClass="border-yellow-200" />
        <RoleCard role="PERSONALER" roleLabel="Personalverwaltung" description="Mitarbeiterdaten, Urlaub, Kleidung" iconBgClass="bg-purple-100" borderClass="border-purple-200" />
      </div>
    </div>
  );
}