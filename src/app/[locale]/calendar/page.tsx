'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';
import { Plus, List, Calendar as CalendarIcon, Trash2, ExternalLink, Pencil } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import AddVacationModal from '@/components/calendar/AddVacationModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType =
  | 'VACATION' | 'SICK' | 'SPECIAL' | 'SCHOOL' | 'SCHOOL_BLOCK'
  | 'DOC_EXPIRY' | 'FIXED_TERM' | 'PROBATION'
  | 'BIRTHDAY' | 'ANNIVERSARY' | 'ANNIVERSARY_MILESTONE'
  | 'FIRST_DAY' | 'HOLIDAY' | 'QUALIFICATION_EXPIRY';

type SourceType = 'vacation' | 'document' | 'employee' | 'birthday' | 'anniversary' | 'firstday' | 'holiday' | 'qualification';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  start: string;
  end: string;
  notes: string | null;
  sourceId: string;
  sourceType: SourceType;
  yearsCount?: number;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: { name: string } | null;
  };
  document?: { id: string; title: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  VACATION:              '#3B82F6',
  SICK:                  '#EF4444',
  SPECIAL:               '#8B5CF6',
  SCHOOL:                '#EAB308',
  SCHOOL_BLOCK:          '#F97316',
  DOC_EXPIRY:            '#F97316',
  FIXED_TERM:            '#B45309',
  PROBATION:             '#D97706',
  BIRTHDAY:              '#EC4899',
  ANNIVERSARY:           '#34D399',
  ANNIVERSARY_MILESTONE: '#F59E0B',
  FIRST_DAY:             '#059669',
  HOLIDAY:               '#94A3B8',
  QUALIFICATION_EXPIRY:  '#0EA5E9',
};

const TYPE_LABELS: Record<string, string> = {
  VACATION:              'Urlaub',
  SICK:                  'Krankheit',
  SPECIAL:               'Sonderurlaub',
  SCHOOL:                'Berufsschule',
  SCHOOL_BLOCK:          'UBL – Blockwoche',
  DOC_EXPIRY:            'Dok. läuft ab',
  FIXED_TERM:            'Befristung',
  PROBATION:             'Probezeit',
  BIRTHDAY:              'Geburtstag',
  ANNIVERSARY:           'Jubiläum',
  ANNIVERSARY_MILESTONE: 'Besond. Jubiläum',
  FIRST_DAY:             'Erster Arbeitstag',
  HOLIDAY:               'Feiertag NRW',
  QUALIFICATION_EXPIRY:  'Qualifikation läuft ab',
};

// Groups for the filter section
const FILTER_GROUPS: { label: string; types: EventType[] }[] = [
  {
    label: 'Abwesenheiten',
    types: ['SICK', 'VACATION', 'SPECIAL', 'SCHOOL', 'SCHOOL_BLOCK'],
  },
  {
    label: 'Fristen',
    types: ['DOC_EXPIRY', 'FIXED_TERM', 'PROBATION', 'QUALIFICATION_EXPIRY'],
  },
  {
    label: 'Mitarbeiter',
    types: ['BIRTHDAY', 'ANNIVERSARY', 'ANNIVERSARY_MILESTONE', 'FIRST_DAY'],
  },
  {
    label: 'Sonstiges',
    types: ['HOLIDAY'],
  },
];

const VALID_START = '2026-01-01';
const VALID_END = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() + 24);
  d.setDate(1);
  return d.toISOString().split('T')[0];
})();

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

function daysBetween(start: string, end: string): number {
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'de';
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<EventType>>(
    new Set(Object.keys(TYPE_COLORS) as EventType[])
  );

  useEffect(() => {
    setMounted(true);
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/events');
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selected || selected.sourceType !== 'vacation') return;
    const name = `${selected.employee?.firstName} ${selected.employee?.lastName}`;
    if (!confirm(`Urlaub von ${name} wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/vacations/${selected.sourceId}`, { method: 'DELETE' });
      setSelected(null);
      fetchEvents();
    } catch {
      alert('Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveDates(startDate: string, endDate: string) {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/vacations/${selected.sourceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (!res.ok) { alert('Fehler beim Speichern'); return; }
      setSelected(null);
      fetchEvents();
    } catch {
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  function toggleType(type: EventType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function toggleGroup(types: EventType[]) {
    const allActive = types.every((t) => visibleTypes.has(t));
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (allActive) types.forEach((t) => next.delete(t));
      else types.forEach((t) => next.add(t));
      return next;
    });
  }

  const filteredEvents = events.filter((e) => visibleTypes.has(e.type));

  const ABSENCE_TYPES = new Set(['VACATION', 'SICK', 'SPECIAL', 'SCHOOL', 'SCHOOL_BLOCK']);

  const EVENT_SORT_ORDER: Partial<Record<EventType, number>> = {
    SICK: 1, VACATION: 2, SPECIAL: 3, SCHOOL: 4, SCHOOL_BLOCK: 5,
  };

  const calendarEvents = filteredEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: addOneDay(e.end),
    backgroundColor: e.type === 'HOLIDAY' ? '#F1F5F9' : (TYPE_COLORS[e.type] ?? '#6B7280'),
    borderColor:     e.type === 'HOLIDAY' ? '#CBD5E1' : (TYPE_COLORS[e.type] ?? '#6B7280'),
    textColor:       e.type === 'HOLIDAY' ? '#64748B' : '#ffffff',
    allDay: true,
    display: e.type === 'HOLIDAY' ? 'background' : 'block',
    extendedProps: {
      typeLabel: ABSENCE_TYPES.has(e.type) ? (TYPE_LABELS[e.type] ?? '') : '',
      isAbsence: ABSENCE_TYPES.has(e.type),
      sortOrder: EVENT_SORT_ORDER[e.type] ?? 99,
    },
  }));

  // Count per type
  const countByType = (type: EventType) => events.filter((e) => e.type === type).length;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kalender</h1>
          <p className="mt-2 text-sm text-gray-600">
            Urlaube, Fristen, Jubiläen und Feiertage im Überblick
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowList(!showList)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showList ? <CalendarIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}
            <span>{showList ? 'Kalenderansicht' : 'Listenansicht'}</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-5 w-5" />
              <span>Abwesenheit hinzufügen</span>
            </button>
          )}
        </div>
      </div>

      <AddVacationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchEvents}
      />

      {/* ── Filter groups ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {FILTER_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-2">
            {/* Group toggle label */}
            <button
              onClick={() => toggleGroup(group.types)}
              className="w-28 flex-shrink-0 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
            >
              {group.label}
            </button>
            {/* Individual type chips */}
            {group.types.map((type) => {
              const active = visibleTypes.has(type);
              const count = countByType(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all"
                  style={{
                    borderColor: TYPE_COLORS[type],
                    backgroundColor: active ? TYPE_COLORS[type] + '22' : 'transparent',
                    color: active ? TYPE_COLORS[type] : '#9CA3AF',
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: active ? TYPE_COLORS[type] : '#D1D5DB' }}
                  />
                  {TYPE_LABELS[type]}
                  {count > 0 && (
                    <span
                      className="ml-0.5 rounded-full px-1.5 py-0.5 text-xs"
                      style={{
                        backgroundColor: active ? TYPE_COLORS[type] + '33' : '#F3F4F6',
                        color: active ? TYPE_COLORS[type] : '#9CA3AF',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white">
          <div className="text-gray-500">Laden...</div>
        </div>
      ) : showList ? (
        <EventList events={filteredEvents} onSelect={setSelected} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {mounted && (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={deLocale}
              firstDay={1}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek',
              }}
              buttonText={{ today: 'Heute', month: 'Monat', week: 'Woche' }}
              events={calendarEvents}
              eventContent={(arg) => {
                const { typeLabel, isAbsence } = arg.event.extendedProps as { typeLabel: string; isAbsence: boolean };
                if (!isAbsence || !typeLabel) return true;
                return (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', overflow: 'hidden', padding: '0 2px' }}>
                    <span style={{ opacity: 0.7, fontSize: '0.72em', whiteSpace: 'nowrap', flexShrink: 0 }}>{typeLabel}</span>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85em' }}>{arg.event.title}</span>
                  </div>
                );
              }}
              eventClick={(info) => {
                // Background events (holidays) don't support click — skip
                if (info.event.display === 'background') return;
                const ev = events.find((e) => e.id === info.event.id);
                if (ev) setSelected(ev);
              }}
              validRange={{ start: VALID_START, end: VALID_END }}
              height="auto"
              eventDisplay="block"
              eventOrder={(a: { extendedProps: { sortOrder?: number } }, b: { extendedProps: { sortOrder?: number } }) =>
                (a.extendedProps?.sortOrder ?? 99) - (b.extendedProps?.sortOrder ?? 99)
              }
              dayMaxEvents={5}
            />
          )}
        </div>
      )}

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {selected && (
        <EventDetailModal
          event={selected}
          locale={locale}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onSaveDates={handleSaveDates}
          deleting={deleting}
          saving={saving}
        />
      )}
    </div>
  );
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────

function EventDetailModal({
  event,
  locale,
  isAdmin,
  onClose,
  onDelete,
  onSaveDates,
  deleting,
  saving,
}: {
  event: CalendarEvent;
  locale: string;
  isAdmin: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSaveDates: (startDate: string, endDate: string) => void;
  deleting: boolean;
  saving: boolean;
}) {
  const isVacation  = event.sourceType === 'vacation';
  const isMultiDay  = event.start !== event.end;
  const days        = isMultiDay ? daysBetween(event.start, event.end) : null;

  const [editingDates, setEditingDates] = useState(false);
  const [editStart, setEditStart] = useState(event.start);
  const [editEnd, setEditEnd] = useState(event.end);
  const [dateError, setDateError] = useState('');

  const dateLabel: Record<string, string> = {
    DOC_EXPIRY:          'Ablaufdatum',
    FIXED_TERM:          'Vertragsende',
    PROBATION:           'Probezeit-Ende',
    BIRTHDAY:            'Geburtstag',
    ANNIVERSARY:         'Jubiläumsdatum',
    ANNIVERSARY_MILESTONE: 'Jubiläumsdatum',
    FIRST_DAY:           'Erster Arbeitstag',
    QUALIFICATION_EXPIRY: 'Ablaufdatum',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <span
            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: (TYPE_COLORS[event.type] ?? '#6B7280') + '22',
              color: TYPE_COLORS[event.type] ?? '#6B7280',
            }}
          >
            {TYPE_LABELS[event.type] ?? event.type}
          </span>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600"
            aria-label="Schließen"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 text-sm">
          {/* Employee (if any) */}
          {event.employee && (
            <div>
              <p className="text-xs text-gray-500">Mitarbeiter</p>
              <p className="font-medium text-gray-900">
                {event.employee.firstName} {event.employee.lastName}{' '}
                <span className="text-gray-400">({event.employee.employeeNumber})</span>
              </p>
              {event.employee.department && (
                <p className="text-xs text-gray-500">{event.employee.department.name}</p>
              )}
            </div>
          )}

          {/* Document title */}
          {event.document && (
            <div>
              <p className="text-xs text-gray-500">Dokument</p>
              <p className="font-medium text-gray-900">{event.document.title}</p>
            </div>
          )}

          {/* Years count (birthday / anniversary) */}
          {event.yearsCount !== undefined && (
            <div>
              <p className="text-xs text-gray-500">
                {event.type === 'BIRTHDAY' ? 'Alter' : 'Jahre im Unternehmen'}
              </p>
              <p className="text-2xl font-bold" style={{ color: TYPE_COLORS[event.type] }}>
                {event.yearsCount}
                {event.type === 'BIRTHDAY' ? ' Jahre' :
                 event.yearsCount === 1 ? ' Jahr' : ' Jahre'}
              </p>
              {(event.type === 'ANNIVERSARY_MILESTONE') && (
                <p className="text-xs font-semibold text-amber-600">✦ Besonderes Jubiläum</p>
              )}
            </div>
          )}

          {/* Date(s) */}
          {isVacation && editingDates ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Von</label>
                  <input
                    type="date"
                    value={editStart}
                    onChange={(e) => { setEditStart(e.target.value); setDateError(''); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bis</label>
                  <input
                    type="date"
                    value={editEnd}
                    min={editStart}
                    onChange={(e) => { setEditEnd(e.target.value); setDateError(''); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
              {dateError && <p className="text-xs text-red-600">{dateError}</p>}
            </div>
          ) : isMultiDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Von</p>
                <p className="font-medium text-gray-900">{formatDate(event.start)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Bis</p>
                <p className="font-medium text-gray-900">{formatDate(event.end)}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500">{dateLabel[event.type] ?? 'Datum'}</p>
              <p className="font-medium text-gray-900">{formatDate(event.start)}</p>
            </div>
          )}

          {/* Duration (vacations) */}
          {days !== null && !editingDates && (
            <div>
              <p className="text-xs text-gray-500">Dauer</p>
              <p className="font-medium text-gray-900">{days} {days === 1 ? 'Tag' : 'Tage'}</p>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div>
              <p className="text-xs text-gray-500">Notizen</p>
              <p className="text-gray-900">{event.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {editingDates ? (
            <>
              <button
                onClick={() => { setEditingDates(false); setEditStart(event.start); setEditEnd(event.end); setDateError(''); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  if (editEnd < editStart) { setDateError('Enddatum muss nach dem Anfangsdatum liegen.'); return; }
                  onSaveDates(editStart, editEnd);
                }}
                disabled={saving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Schließen
              </button>

              {event.employee && (
                <a
                  href={`/${locale}/employees/${event.employee.id}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Zum Mitarbeiter
                </a>
              )}

              {isVacation && isAdmin && (
                <button
                  onClick={() => setEditingDates(true)}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Dauer ändern
                </button>
              )}

              {isVacation && isAdmin && (
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Löschen...' : 'Löschen'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Event List ───────────────────────────────────────────────────────────────

function EventList({
  events,
  onSelect,
}: {
  events: CalendarEvent[];
  onSelect: (e: CalendarEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white">
        <CalendarIcon className="h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Einträge</h3>
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['Datum', 'Typ', 'Bezeichnung', 'Mitarbeiter / Abteilung', ''].map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sorted.map((ev) => {
            const isMultiDay = ev.start !== ev.end;
            const isHoliday  = ev.type === 'HOLIDAY';
            return (
              <tr key={ev.id} className="hover:bg-gray-50">
                {/* Date */}
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {isMultiDay
                    ? `${formatDate(ev.start)} – ${formatDate(ev.end)}`
                    : formatDate(ev.start)}
                </td>

                {/* Type badge */}
                <td className="whitespace-nowrap px-6 py-4">
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: (TYPE_COLORS[ev.type] ?? '#6B7280') + '22',
                      color: TYPE_COLORS[ev.type] ?? '#6B7280',
                    }}
                  >
                    {TYPE_LABELS[ev.type] ?? ev.type}
                  </span>
                </td>

                {/* Title / details */}
                <td className="px-6 py-4 text-sm text-gray-900">
                  <span className="font-medium">{ev.title}</span>
                  {ev.yearsCount !== undefined && !isHoliday && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({ev.yearsCount} {ev.yearsCount === 1 ? 'Jahr' : 'Jahre'})
                    </span>
                  )}
                  {isMultiDay && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({daysBetween(ev.start, ev.end)} Tage)
                    </span>
                  )}
                </td>

                {/* Employee */}
                <td className="px-6 py-4">
                  {ev.employee ? (
                    <>
                      <div className="text-sm text-gray-900">
                        {ev.employee.firstName} {ev.employee.lastName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {ev.employee.department?.name ?? ev.employee.employeeNumber}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Detail button */}
                <td className="whitespace-nowrap px-6 py-4">
                  {!isHoliday && (
                    <button
                      onClick={() => onSelect(ev)}
                      className="text-gray-400 hover:text-gray-700"
                      title="Details"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
