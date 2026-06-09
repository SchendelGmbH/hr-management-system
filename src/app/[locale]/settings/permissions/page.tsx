'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield, LayoutDashboard, Users, Briefcase, Award, Shirt, FileText, Car,
  CalendarDays, Bell, Settings2, Loader2, CheckCircle, Save, ChevronRight, ChevronDown
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessLevel = 'none' | 'read' | 'write';

interface DbRole {
  id: string;
  name: string;
  description: string | null;
  rolePermissions: Array<{ module: string; action: string; access: string }>;
}

interface PermissionState {
  [key: string]: AccessLevel;
}

interface MasterSwitchState {
  [key: string]: AccessLevel | null;
}

// ─── Module Config ────────────────────────────────────────────────────────────

const MODULES: { key: string; label: string; icon: React.ElementType; actions: { action: string; label: string }[] }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, actions: [{ action: 'view', label: 'Dashboard anzeigen' }] },
  { key: 'employees', label: 'Mitarbeiter', icon: Users, actions: [
      { action: 'view', label: 'Liste anzeigen' }, { action: 'details', label: 'Details anzeigen' },
      { action: 'create', label: 'Neuen erstellen' }, { action: 'edit', label: 'Bearbeiten' },
      { action: 'delete', label: 'Löschen' }, { action: 'portal', label: 'Portal-Zugang' },
      { action: 'password', label: 'Passwort zurücksetzen' }, { action: 'clothing', label: 'Kleidung' },
      { action: 'qualifications', label: 'Qualifikationen' },
  ]},
  { key: 'vacations', label: 'Urlaub', icon: Briefcase, actions: [
      { action: 'view_own', label: 'Eigenen Urlaub' }, { action: 'view_all', label: 'Alle Urlaube' },
      { action: 'request', label: 'Beantragen' }, { action: 'approve', label: 'Genehmigen' },
      { action: 'edit', label: 'Bearbeiten' }, { action: 'delete', label: 'Löschen' },
  ]},
  { key: 'qualifications', label: 'Qualifikationen', icon: Award, actions: [
      { action: 'view', label: 'Anzeigen' }, { action: 'manage_types', label: 'Typen verwalten' },
      { action: 'create', label: 'Neue erstellen' }, { action: 'edit', label: 'Bearbeiten' }, { action: 'delete', label: 'Löschen' },
  ]},
  { key: 'clothing', label: 'Kleidung', icon: Shirt, actions: [
      { action: 'view_items', label: 'Kleidungsstücke' }, { action: 'view_orders', label: 'Bestellungen' },
      { action: 'create_order', label: 'Bestellung erstellen' }, { action: 'approve_order', label: 'Genehmigen' },
      { action: 'delete_order', label: 'Löschen' }, { action: 'create_item', label: 'Anlegen' },
      { action: 'edit_item', label: 'Bearbeiten' }, { action: 'delete_item', label: 'Löschen' },
  ]},
  { key: 'documents', label: 'Dokumente', icon: FileText, actions: [
      { action: 'view', label: 'Anzeigen' }, { action: 'upload', label: 'Hochladen' },
      { action: 'download', label: 'Herunterladen' }, { action: 'edit', label: 'Bearbeiten' },
      { action: 'delete', label: 'Löschen' }, { action: 'templates', label: 'Vorlagen' },
      { action: 'categories', label: 'Kategorien' },
  ]},
  { key: 'vehicles', label: 'Fahrzeuge', icon: Car, actions: [
      { action: 'view', label: 'Anzeigen' }, { action: 'create', label: 'Neues' },
      { action: 'edit', label: 'Bearbeiten' }, { action: 'delete', label: 'Löschen' },
  ]},
  { key: 'dailyPlans', label: 'Tagespläne', icon: CalendarDays, actions: [
      { action: 'view', label: 'Anzeigen' }, { action: 'edit', label: 'Bearbeiten' },
      { action: 'manage_sites', label: 'Stammbaustellen' },
  ]},
  { key: 'calendar', label: 'Kalender', icon: CalendarDays, actions: [
      { action: 'view', label: 'Kalender anzeigen' }, { action: 'add_absence', label: 'Abwesenheit hinzufügen' },
      { action: 'edit_absence', label: 'Bearbeiten' }, { action: 'delete_absence', label: 'Löschen' },
  ]},
  { key: 'settings', label: 'Einstellungen', icon: Settings2, actions: [
      { action: 'audit_log', label: 'Audit-Log' }, { action: 'roles', label: 'Rollenverwaltung' },
      { action: 'permissions', label: 'Permissions' },
  ]},
];

const ACCESS_ORDER: AccessLevel[] = ['none', 'read', 'write'];
const SWITCH_LABELS: Record<AccessLevel, string> = { none: 'Keine', read: 'Lesen', write: 'Lesen & Schreiben' };
const SWITCH_COLORS: Record<AccessLevel, string> = { none: 'bg-gray-300', read: 'bg-blue-500', write: 'bg-green-500' };
const SWITCH_POSITIONS = [2, 44, 86];

// ─── Role Config ─────────────────────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, { label: string; bg: string; border: string }> = {
  ADMIN: { label: 'Administrator', bg: 'bg-orange-100', border: 'border-orange-200' },
  MITARBEITER: { label: 'Mitarbeiter', bg: 'bg-blue-100', border: 'border-blue-200' },
  GEWERBLICH: { label: 'Gewerblich', bg: 'bg-yellow-100', border: 'border-yellow-200' },
  PERSONALVERWALTUNG: { label: 'Personalverwaltung', bg: 'bg-purple-100', border: 'border-purple-200' },
};

// ─── Access Switch ───────────────────────────────────────────────────────────

function AccessSwitch({
  access,
  onChange,
  disabled = false,
}: {
  access: AccessLevel;
  onChange?: (direction: 'left' | 'right') => void;
  disabled?: boolean;
}) {
  const idx = ACCESS_ORDER.indexOf(access);
  const safeIdx = idx < 0 ? 0 : idx;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled || !onChange) return;
    const rect = e.currentTarget.querySelector('.switch-track')?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    if (clickX < trackWidth / 3) onChange('left');
    else if (clickX > (trackWidth * 2) / 3) onChange('right');
    else {
      let nearestIdx = 0, nearestDist = Infinity;
      for (let i = 0; i < SWITCH_POSITIONS.length; i++) {
        const dist = Math.abs(clickX - (SWITCH_POSITIONS[i] + 10));
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
      }
      const nearest = ACCESS_ORDER[nearestIdx];
      if (nearest !== access) onChange(nearestIdx < idx ? 'left' : 'right');
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`relative flex items-center gap-1.5 rounded-full px-1.5 py-1 transition-all select-none ${
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-105'
      }`}
      title={disabled ? 'ADMIN-Rolle ist nicht editierbar' : 'Klicken für nächste Stufe'}
    >
      <div className={`switch-track relative h-7 w-[108px] rounded-full ${SWITCH_COLORS[access]} transition-colors duration-300`}>
        <div
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md flex items-center justify-center transition-all duration-300"
          style={{ left: SWITCH_POSITIONS[safeIdx] }}
        >
          {access !== 'none' && <CheckCircle className="h-3 w-3 text-white" />}
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

// ─── Role Card ───────────────────────────────────────────────────────────────

function RoleCard({
  roleId,
  roleName,
  roleLabel,
  initialPermissions,
  disabled,
}: {
  roleId: string;
  roleName: string;
  roleLabel: string;
  initialPermissions: Array<{ module: string; action: string; access: string }>;
  disabled: boolean;
}) {
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [masterSwitches, setMasterSwitches] = useState<MasterSwitchState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(MODULES.map(m => m.key)));

  const loadPermissions = useCallback(() => {
    const state: PermissionState = {};
    for (const p of initialPermissions) {
      state[`${p.module}:${p.action}`] = p.access as AccessLevel;
    }
    setPermissions(state);
    setLoading(false);
  }, [initialPermissions]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  function toggleExpand(key: string) {
    setExpandedModules(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  function getEffectiveAccess(module: string, action: string): AccessLevel {
    const masterKey = `${module}`;
    const masterAccess = masterSwitches[masterKey];
    if (masterAccess !== null && masterAccess !== undefined) return masterAccess;
    return permissions[`${module}:${action}`] ?? 'none';
  }

  function getMasterAccess(module: string): AccessLevel | null {
    return masterSwitches[module] ?? null;
  }

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

  function cycleMasterAccess(module: string, direction: 'left' | 'right') {
    if (disabled) return;
    const current = getModuleHighestAccess(module);
    const idx = Math.max(0, ACCESS_ORDER.indexOf(current));
    const next = ACCESS_ORDER[(idx + (direction === 'right' ? 1 : ACCESS_ORDER.length - 1)) % ACCESS_ORDER.length];
    const moduleActions = MODULES.find(m => m.key === module)?.actions ?? [];
    setPermissions(prev => {
      const updated = { ...prev };
      for (const act of moduleActions) updated[`${module}:${act.action}`] = next;
      return updated;
    });
    setMasterSwitches(prev => ({ ...prev, [module]: next }));
    setSaved(false);
  }

  function cycleAccess(module: string, action: string, direction: 'left' | 'right') {
    if (disabled) return;
    const key = `${module}:${action}`;
    const current = getEffectiveAccess(module, action);
    const idx = Math.max(0, ACCESS_ORDER.indexOf(current));
    const next = ACCESS_ORDER[(idx + (direction === 'right' ? 1 : ACCESS_ORDER.length - 1)) % ACCESS_ORDER.length];
    if (masterSwitches[module] !== null && masterSwitches[module] !== undefined) {
      setMasterSwitches(prev => { const n = { ...prev }; delete n[module]; return n; });
    }
    setPermissions(prev => ({ ...prev, [key]: next }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const items = Object.entries(permissions).map(([key, access]) => {
        const [module, action] = key.split(':');
        return { roleId, module, action, access };
      });
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message || 'Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  }

  return (
    <div className={`rounded-xl border-2 ${ROLE_DISPLAY[roleName]?.border ?? 'border-gray-200'} bg-white shadow-sm overflow-hidden`}>
      <div className={`px-6 py-4 border-b border-gray-100 ${ROLE_DISPLAY[roleName]?.bg ?? 'bg-gray-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/60 p-2"><Shield className="h-5 w-5 text-orange-600" /></div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{roleLabel}</h2>
              {disabled && <span className="text-xs text-orange-600 font-medium">⚠️ Nicht editierbar</span>}
            </div>
          </div>
          {!disabled && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${saved ? 'bg-green-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'} ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? '...' : saved ? 'OK' : 'Speichern'}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
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
                    <button onClick={() => toggleExpand(mod.key)} className="flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors">
                      {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-900">{mod.label}</span>
                    </button>
                    <div className="ml-auto">
                      <AccessSwitch
                        access={hasMaster ? masterAccess! : highestAccess}
                        onChange={disabled ? undefined : (dir) => cycleMasterAccess(mod.key, dir)}
                        disabled={disabled}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-6 space-y-1.5 mt-1">
                      {mod.actions.map(act => (
                        <div key={act.action} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{act.label}</span>
                          <AccessSwitch
                            access={getEffectiveAccess(mod.key, act.action)}
                            onChange={disabled ? undefined : (dir) => cycleAccess(mod.key, act.action, dir)}
                            disabled={disabled}
                          />
                        </div>
                      ))}
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
  const [roles, setRoles] = useState<DbRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/permissions')
      .then(r => r.json())
      .then(data => { setRoles(data); setLoading(false); })
      .catch(() => { setError('Laden fehlgeschlagen'); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">← Zurück zu Einstellungen</Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Berechtigungsübersicht</h1>
          <p className="mt-2 text-sm text-gray-600">Master-Switch pro Kategorie steuert alle Unterpunkte — zeigt höchstes Recht</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stufen:</span>
        {[{ value: 'none', label: 'Keine', color: 'bg-gray-400' }, { value: 'read', label: 'Lesen', color: 'bg-blue-500' }, { value: 'write', label: 'Lesen & Schreiben', color: 'bg-green-500' }].map(opt => (
          <div key={opt.value} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${opt.color}`} />
            <span className="text-xs text-gray-600">{opt.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {roles.map(role => {
            const display = ROLE_DISPLAY[role.name] ?? { label: role.name, bg: 'bg-gray-100', border: 'border-gray-200' };
            return (
              <RoleCard
                key={role.id}
                roleId={role.id}
                roleName={role.name}
                roleLabel={display.label}
                initialPermissions={role.rolePermissions}
                disabled={role.name === 'ADMIN'}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}