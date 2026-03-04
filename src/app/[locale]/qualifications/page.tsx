'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Award, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

type QualificationGroup = 'INSTRUCTION' | 'CERTIFICATE' | 'TRAINING';
type StatusFilter = 'all' | 'valid' | 'expiring' | 'expired';

const GROUP_LABELS: Record<QualificationGroup, string> = {
  INSTRUCTION: 'Unterweisungen',
  CERTIFICATE: 'Zertifikate & Lizenzen',
  TRAINING: 'Fortbildungen',
};

interface QualificationItem {
  id: string;
  issuedAt: string | null;
  expiresAt: string | null;
  issuer: string | null;
  certNumber: string | null;
  notes: string | null;
  filePath: string | null;
  fileName: string | null;
  type: {
    id: string;
    name: string;
    group: QualificationGroup;
    recurringIntervalMonths: number | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department: { name: string } | null;
  };
}

interface Counts {
  total: number;
  expiring: number;
  expired: number;
}

function getStatus(expiresAt: string | null): 'none' | 'valid' | 'expiring' | 'expired' {
  if (!expiresAt) return 'none';
  const now = new Date();
  const exp = new Date(expiresAt);
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  if (exp < now) return 'expired';
  if (exp <= in60) return 'expiring';
  return 'valid';
}

function StatusBadge({ expiresAt }: { expiresAt: string | null }) {
  const s = getStatus(expiresAt);
  if (s === 'none') return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Kein Ablauf</span>;
  if (s === 'expired') return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"><XCircle className="h-3 w-3" />Abgelaufen</span>;
  if (s === 'expiring') return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700"><AlertTriangle className="h-3 w-3" />Läuft bald ab</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"><CheckCircle className="h-3 w-3" />Gültig</span>;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const GROUP_ORDER: QualificationGroup[] = ['INSTRUCTION', 'CERTIFICATE', 'TRAINING'];

export default function QualificationsPage() {
  const [qualifications, setQualifications] = useState<QualificationItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, expiring: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState<QualificationGroup | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<QualificationGroup>>(new Set());

  const fetchQualifications = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (groupFilter !== 'all') params.set('group', groupFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);

    const res = await fetch(`/api/qualifications?${params}`);
    if (res.ok) {
      const data = await res.json();
      setQualifications(data.qualifications);
      setCounts(data.counts);
    }
    setLoading(false);
  }, [groupFilter, statusFilter]);

  useEffect(() => { fetchQualifications(); }, [fetchQualifications]);

  const toggleGroup = (g: QualificationGroup) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  // Group by QualificationGroup
  const grouped: Record<QualificationGroup, QualificationItem[]> = {
    INSTRUCTION: [],
    CERTIFICATE: [],
    TRAINING: [],
  };
  for (const q of qualifications) {
    grouped[q.type.group].push(q);
  }

  const groupsToShow = groupFilter === 'all'
    ? GROUP_ORDER
    : [groupFilter as QualificationGroup];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Qualifikationen</h1>
        <p className="mt-1 text-sm text-gray-600">Übersicht aller Qualifikationen, Zertifikate und Unterweisungen</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
              <p className="text-sm text-gray-500">Gesamt</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">{counts.expiring}</p>
              <p className="text-sm text-yellow-700">Läuft bald ab (≤60 Tage)</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-900">{counts.expired}</p>
              <p className="text-sm text-red-700">Abgelaufen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Group filter */}
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          {(['all', ...GROUP_ORDER] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                groupFilter === g
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {g === 'all' ? 'Alle Gruppen' : GROUP_LABELS[g]}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          {([
            { v: 'all', label: 'Alle Status' },
            { v: 'valid', label: 'Gültig' },
            { v: 'expiring', label: 'Läuft bald ab' },
            { v: 'expired', label: 'Abgelaufen' },
          ] as const).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === v
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : qualifications.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
          <Award className="h-12 w-12 text-gray-400" />
          <p className="mt-4 text-lg font-medium">Keine Qualifikationen gefunden</p>
          <p className="mt-1 text-sm">Passen Sie die Filter an oder fügen Sie Qualifikationen bei Mitarbeitern hinzu.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupsToShow.map((group) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            const isCollapsed = collapsedGroups.has(group);
            return (
              <div key={group} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">{GROUP_LABELS[group]}</h2>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {items.length}
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronUp className="h-5 w-5 text-gray-400" />}
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Mitarbeiter</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Abteilung</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Typ</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ausgestellt</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Läuft ab</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Anhang</th>
                          <th className="px-6 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {items.map((q) => (
                          <tr key={q.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-6 py-3">
                              <div className="font-medium text-gray-900">
                                {q.employee.firstName} {q.employee.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{q.employee.employeeNumber}</div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-600">
                              {q.employee.department?.name ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3">
                              <div className="text-sm font-medium text-gray-900">{q.type.name}</div>
                              {q.type.recurringIntervalMonths && (
                                <div className="text-xs text-gray-500">
                                  Alle {q.type.recurringIntervalMonths} Monate
                                </div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-600">
                              {formatDate(q.issuedAt)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-600">
                              {formatDate(q.expiresAt)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3">
                              <StatusBadge expiresAt={q.expiresAt} />
                            </td>
                            <td className="whitespace-nowrap px-6 py-3 text-sm">
                              {q.filePath ? (
                                <a
                                  href={q.filePath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:underline"
                                >
                                  {q.fileName ?? 'Datei'}
                                </a>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3 text-right">
                              <Link
                                href={`/de/employees/${q.employee.id}?tab=qualifications`}
                                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Zum Mitarbeiter
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
