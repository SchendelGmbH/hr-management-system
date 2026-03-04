'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Plus, X, Pencil, Check, Trash2, Printer,
  AlertTriangle, Car, Clock, MapPin,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type VacationType = 'VACATION' | 'SICK' | 'SPECIAL' | 'SCHOOL' | 'SCHOOL_BLOCK';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  position?: string | null;
  department?: { name: string } | null;
}

interface Assignment {
  id?: string;
  employeeId: string;
  employee: Employee;
  note?: string | null;
}

interface PlanSite {
  _tempId?: string;       // for new unsaved sites
  id?: string;
  name: string;
  location?: string;
  vehiclePlate?: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  assignments: Assignment[];
  isEditing?: boolean;
}

interface Absence {
  id: string;
  vacationType: VacationType;
  employee: Employee;
}

interface WorkSite {
  id: string;
  name: string;
  location?: string | null;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultVehiclePlate?: string | null;
}

interface Vehicle {
  id: string;
  plate: string;
  description?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ABSENCE_LABELS: Record<VacationType, string> = {
  VACATION: 'Urlaub',
  SICK: 'Krank',
  SPECIAL: 'Sonderurlaub',
  SCHOOL: 'Schule',
  SCHOOL_BLOCK: 'UBL',
};

const ABSENCE_COLORS: Record<VacationType, string> = {
  VACATION: 'bg-blue-100 text-blue-700',
  SICK: 'bg-red-100 text-red-700',
  SPECIAL: 'bg-purple-100 text-purple-700',
  SCHOOL: 'bg-yellow-100 text-yellow-700',
  SCHOOL_BLOCK: 'bg-orange-100 text-orange-700',
};

function formatDateDE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

let tempIdCounter = 0;
function newTempId() { return `temp-${++tempIdCounter}`; }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyPlanningPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const router = useRouter();

  const [sites, setSites] = useState<PlanSite[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [workSites, setWorkSites] = useState<WorkSite[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isTemplate, setIsTemplate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Which employee is being assigned (click from pool)
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null);
  // Drag & Drop – employees
  const [draggingEmployee, setDraggingEmployee] = useState<Employee | null>(null);
  const [draggingFromSiteIdx, setDraggingFromSiteIdx] = useState<number | null>(null);
  const [dragOverSiteIdx, setDragOverSiteIdx] = useState<number | null>(null);
  // Drag & Drop – vehicles
  const [draggingVehicle, setDraggingVehicle] = useState<Vehicle | null>(null);
  const [draggingVehicleFromSiteIdx, setDraggingVehicleFromSiteIdx] = useState<number | null>(null);
  // Fahrzeugpool form
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleFormPlate, setVehicleFormPlate] = useState('');
  const [vehicleFormDesc, setVehicleFormDesc] = useState('');
  const [vehicleFormError, setVehicleFormError] = useState('');
  const [vehicleFormLoading, setVehicleFormLoading] = useState(false);
  // Drag & Drop – absences
  const [dragOverAbsenceType, setDragOverAbsenceType] = useState<VacationType | null>(null);
  const [draggingFromAbsenceId, setDraggingFromAbsenceId] = useState<string | null>(null);
  const absenceDropHandledRef = useRef(false);
  // Which assignment is being noted
  const [editingNote, setEditingNote] = useState<{ siteIdx: number; empIdx: number } | null>(null);
  const [noteValue, setNoteValue] = useState('');
  // Delete site confirm
  const [deleteSiteIdx, setDeleteSiteIdx] = useState<number | null>(null);
  // Autocomplete
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  // New site form
  const [showNewSiteForm, setShowNewSiteForm] = useState(false);
  const [newSiteForm, setNewSiteForm] = useState({ name: '', location: '', vehiclePlate: '', startTime: '06:00', endTime: '16:00' });

  const saveToServer = useCallback(async (updatedSites: PlanSite[]) => {
    setSaving(true);
    try {
      const body = {
        sites: updatedSites.map((s, i) => ({
          name: s.name,
          location: s.location || undefined,
          vehiclePlate: s.vehiclePlate || undefined,
          startTime: s.startTime,
          endTime: s.endTime,
          sortOrder: i,
          assignments: s.assignments.map((a) => ({
            employeeId: a.employeeId,
            note: a.note || undefined,
          })),
        })),
      };
      await fetch(`/api/daily-plans/${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setIsTemplate(false);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [date]);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, wsRes, vehiclesRes] = await Promise.all([
        fetch(`/api/daily-plans/${date}`),
        fetch('/api/work-sites'),
        fetch('/api/vehicles'),
      ]);
      const planData = await planRes.json();
      const wsData = await wsRes.json();
      const vehiclesData = await vehiclesRes.json();

      setWorkSites(wsData.workSites ?? []);
      setVehicles(vehiclesData.vehicles ?? []);
      setAllEmployees(planData.allEmployees ?? []);
      setAbsences((planData.absences ?? []).map((a: { id: string; vacationType: VacationType; employee: Employee }) => ({
        id: a.id,
        vacationType: a.vacationType,
        employee: a.employee,
      })));
      setIsTemplate(planData.isTemplate ?? false);

      // Convert API sites to local state
      const loadedSites: PlanSite[] = (planData.sites ?? []).map((s: any) => ({
        _tempId: newTempId(),
        id: s.id,
        name: s.name,
        location: s.location ?? '',
        vehiclePlate: s.vehiclePlate ?? '',
        startTime: s.startTime ?? '06:00',
        endTime: s.endTime ?? '16:00',
        sortOrder: s.sortOrder ?? 0,
        assignments: (s.assignments ?? []).map((a: any) => ({
          id: a.id,
          employeeId: a.employeeId,
          employee: a.employee,
          note: a.note ?? '',
        })),
        isEditing: false,
      }));
      setSites(loadedSites);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Computed ─────────────────────────────────────────────────────────────────

  const assignedEmployeeIds = new Set(
    sites.flatMap((s) => s.assignments.map((a) => a.employeeId))
  );
  const absentEmployeeIds = new Set(absences.map((a) => a.employee.id));

  const absenceByEmployee = new Map<string, VacationType>();
  for (const a of absences) {
    absenceByEmployee.set(a.employee.id, a.vacationType);
  }

  const poolEmployees = allEmployees.filter((e) => !assignedEmployeeIds.has(e.id) && !absentEmployeeIds.has(e.id));

  const usedVehiclePlates = new Set(sites.map((s) => s.vehiclePlate).filter(Boolean));
  const poolVehicles = vehicles.filter((v) => !usedVehiclePlates.has(v.plate));

  const groupedAbsences: Record<VacationType, Employee[]> = {
    VACATION: [], SICK: [], SPECIAL: [], SCHOOL: [], SCHOOL_BLOCK: [],
  };
  for (const a of absences) {
    groupedAbsences[a.vacationType].push(a.employee);
  }

  // Total assigned employees (count unique)
  const allAssignedSorted = [...assignedEmployeeIds]
    .map((id) => allEmployees.find((e) => e.id === id)!)
    .filter(Boolean)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  // Autocomplete filter
  const filteredWorkSites = workSites.filter((ws) =>
    ws.name.toLowerCase().includes(autocompleteQuery.toLowerCase()) ||
    (ws.location ?? '').toLowerCase().includes(autocompleteQuery.toLowerCase())
  );

  // ── Actions ───────────────────────────────────────────────────────────────────

  const addSiteFromForm = () => {
    if (!newSiteForm.name.trim()) return;
    const s: PlanSite = {
      _tempId: newTempId(),
      name: newSiteForm.name.trim(),
      location: newSiteForm.location.trim(),
      vehiclePlate: newSiteForm.vehiclePlate.trim(),
      startTime: newSiteForm.startTime || '06:00',
      endTime: newSiteForm.endTime || '16:00',
      sortOrder: sites.length,
      assignments: [],
      isEditing: false,
    };
    const updated = [...sites, s];
    setSites(updated);
    setNewSiteForm({ name: '', location: '', vehiclePlate: '', startTime: '06:00', endTime: '16:00' });
    setShowNewSiteForm(false);
    saveToServer(updated);
  };

  const addSiteFromWorkSite = (ws: WorkSite) => {
    const s: PlanSite = {
      _tempId: newTempId(),
      name: ws.name,
      location: ws.location ?? '',
      vehiclePlate: ws.defaultVehiclePlate ?? '',
      startTime: ws.defaultStartTime,
      endTime: ws.defaultEndTime,
      sortOrder: sites.length,
      assignments: [],
      isEditing: false,
    };
    const updated = [...sites, s];
    setSites(updated);
    setShowNewSiteForm(false);
    setShowAutocomplete(false);
    setAutocompleteQuery('');
    saveToServer(updated);
  };

  const removeSite = (idx: number) => {
    const updated = sites.filter((_, i) => i !== idx);
    setSites(updated);
    setDeleteSiteIdx(null);
    saveToServer(updated);
  };

  const assignEmployee = (emp: Employee, siteIdx: number) => {
    const updated = sites.map((s, i) => {
      if (i !== siteIdx) return s;
      if (s.assignments.find((a) => a.employeeId === emp.id)) return s;
      return { ...s, assignments: [...s.assignments, { employeeId: emp.id, employee: emp, note: '' }] };
    });
    setSites(updated);
    setAssigningEmployee(null);
    saveToServer(updated);
  };

  const moveEmployee = (emp: Employee, fromSiteIdx: number, toSiteIdx: number) => {
    if (fromSiteIdx === toSiteIdx) return;
    const updated = sites.map((s, i) => {
      if (i === fromSiteIdx) return { ...s, assignments: s.assignments.filter((a) => a.employeeId !== emp.id) };
      if (i === toSiteIdx) {
        if (s.assignments.find((a) => a.employeeId === emp.id)) return s;
        return { ...s, assignments: [...s.assignments, { employeeId: emp.id, employee: emp, note: '' }] };
      }
      return s;
    });
    setSites(updated);
    saveToServer(updated);
  };

  const removeAssignment = (siteIdx: number, empId: string) => {
    const updated = sites.map((s, i) => {
      if (i !== siteIdx) return s;
      return { ...s, assignments: s.assignments.filter((a) => a.employeeId !== empId) };
    });
    setSites(updated);
    saveToServer(updated);
  };

  const saveNote = () => {
    if (!editingNote) return;
    const { siteIdx, empIdx } = editingNote;
    const updated = sites.map((s, si) => {
      if (si !== siteIdx) return s;
      return {
        ...s,
        assignments: s.assignments.map((a, ai) =>
          ai === empIdx ? { ...a, note: noteValue } : a
        ),
      };
    });
    setSites(updated);
    setEditingNote(null);
    saveToServer(updated);
  };

  const updateSiteField = (idx: number, field: keyof PlanSite, value: string) => {
    setSites((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const saveSiteEdit = (idx: number) => {
    setSites((prev) => prev.map((s, i) => i === idx ? { ...s, isEditing: false } : s));
    saveToServer(sites.map((s, i) => i === idx ? { ...s, isEditing: false } : s));
  };

  const assignVehicleToPlanSite = (vehicle: Vehicle, siteIdx: number) => {
    const updated = sites.map((s, i) =>
      i === siteIdx ? { ...s, vehiclePlate: vehicle.plate } : s
    );
    setSites(updated);
    saveToServer(updated);
  };

  const moveVehicle = (vehicle: Vehicle, fromSiteIdx: number, toSiteIdx: number) => {
    if (fromSiteIdx === toSiteIdx) return;
    const updated = sites.map((s, i) => {
      if (i === fromSiteIdx) return { ...s, vehiclePlate: '' };
      if (i === toSiteIdx) return { ...s, vehiclePlate: vehicle.plate };
      return s;
    });
    setSites(updated);
    saveToServer(updated);
  };

  const clearVehicleFromSite = (siteIdx: number) => {
    const updated = sites.map((s, i) =>
      i === siteIdx ? { ...s, vehiclePlate: '' } : s
    );
    setSites(updated);
    saveToServer(updated);
  };

  const addVehicle = async () => {
    if (!vehicleFormPlate.trim()) { setVehicleFormError('Kennzeichen erforderlich'); return; }
    setVehicleFormLoading(true);
    setVehicleFormError('');
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: vehicleFormPlate.trim(), description: vehicleFormDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setVehicleFormError(data.error ?? 'Fehler'); return; }
      setVehicles((prev) => [...prev, data.vehicle].sort((a, b) => a.plate.localeCompare(b.plate)));
      setVehicleFormPlate('');
      setVehicleFormDesc('');
      setShowVehicleForm(false);
    } catch {
      setVehicleFormError('Netzwerkfehler');
    } finally {
      setVehicleFormLoading(false);
    }
  };

  const deleteVehicle = async (id: string) => {
    try {
      await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch {
      console.error('Failed to delete vehicle');
    }
  };

  const createAbsenceDirectly = async (employee: Employee, type: VacationType, fromSiteIdx: number | null) => {
    try {
      const res = await fetch('/api/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          startDate: date,
          endDate: date,
          vacationType: type,
        }),
      });
      const data = await res.json();
      if (!res.ok) { console.error('Fehler beim Anlegen der Abwesenheit:', data.error); return; }

      setAbsences((prev) => [...prev, { id: data.vacation.id, vacationType: type, employee }]);

      if (fromSiteIdx !== null) {
        const updated = sites.map((s, i) =>
          i === fromSiteIdx
            ? { ...s, assignments: s.assignments.filter((a) => a.employeeId !== employee.id) }
            : s
        );
        setSites(updated);
        saveToServer(updated);
      }
    } catch {
      console.error('Netzwerkfehler beim Anlegen der Abwesenheit');
    }
  };

  const deleteAbsence = async (id: string) => {
    try {
      await fetch(`/api/vacations/${id}`, { method: 'DELETE' });
    } catch {
      console.error('Failed to delete absence');
    }
  };

  const navigateDate = (delta: number) => {
    router.push(`/de/planning/${offsetDate(date, delta)}`);
  };

  // ── Print ─────────────────────────────────────────────────────────────────────

  const handlePrint = () => window.print();

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {/* ── Print Styles ──────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area { visibility: visible !important; position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 20px; font-size: 11px; font-family: Arial, sans-serif; background: white; }
          #print-area * { visibility: visible !important; }
        }
      `}</style>

      {/* ── Screen UI ─────────────────────────────────────────────────── */}
      <div className="space-y-4 no-print">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigateDate(-1)} className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => router.push(`/de/planning/${e.target.value}`)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button onClick={() => navigateDate(1)} className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50">
              <ChevronRight className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              Tagesplanung – {formatDateDE(date)}
            </h1>
            {date === todayStr() && (
              <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700">Heute</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-gray-400">Speichert…</span>}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Printer className="h-4 w-4" />
              Drucken
            </button>
          </div>
        </div>

        {/* Template banner */}
        {isTemplate && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Vorlage von gestern geladen – erste Änderung speichert den Plan für heute.
          </div>
        )}

        {/* Main 2-column layout */}
        <div className="flex gap-4 items-start">
          {/* ── Left: Baustellen ── */}
          <div className="flex-1 space-y-4">
            {sites.map((site, siteIdx) => (
              <Fragment key={site._tempId ?? site.id}>
              {siteIdx > 0 && (
                <hr className="border-t-2 border-gray-200 -mt-1" />
              )}
              <div
                className={`rounded-lg border bg-white shadow-sm transition-colors ${
                  dragOverSiteIdx === siteIdx
                    ? draggingVehicle
                      ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-50'
                      : 'border-primary-400 ring-2 ring-primary-300 bg-primary-50'
                    : 'border-gray-200'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverSiteIdx(siteIdx); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSiteIdx(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSiteIdx(null);
                  if (draggingVehicle) {
                    if (draggingVehicleFromSiteIdx !== null) {
                      moveVehicle(draggingVehicle, draggingVehicleFromSiteIdx, siteIdx);
                    } else {
                      assignVehicleToPlanSite(draggingVehicle, siteIdx);
                    }
                    setDraggingVehicle(null);
                    setDraggingVehicleFromSiteIdx(null);
                  } else if (draggingEmployee) {
                    absenceDropHandledRef.current = true;
                    if (draggingFromAbsenceId) {
                      setAbsences((prev) => prev.filter((a) => a.id !== draggingFromAbsenceId));
                      deleteAbsence(draggingFromAbsenceId);
                      setDraggingFromAbsenceId(null);
                    }
                    if (draggingFromSiteIdx !== null) {
                      moveEmployee(draggingEmployee, draggingFromSiteIdx, siteIdx);
                    } else {
                      assignEmployee(draggingEmployee, siteIdx);
                    }
                    setDraggingEmployee(null);
                    setDraggingFromSiteIdx(null);
                  }
                }}
              >
                {/* Site header */}
                {site.isEditing ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
                    <input
                      autoFocus
                      value={site.name}
                      onChange={(e) => updateSiteField(siteIdx, 'name', e.target.value)}
                      placeholder="Name"
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <input
                      value={site.location ?? ''}
                      onChange={(e) => updateSiteField(siteIdx, 'location', e.target.value)}
                      placeholder="Ort"
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <input
                      value={site.vehiclePlate ?? ''}
                      onChange={(e) => updateSiteField(siteIdx, 'vehiclePlate', e.target.value)}
                      placeholder="Kennzeichen"
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <input
                      type="time"
                      value={site.startTime}
                      onChange={(e) => updateSiteField(siteIdx, 'startTime', e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <span className="text-gray-400 text-sm">–</span>
                    <input
                      type="time"
                      value={site.endTime}
                      onChange={(e) => updateSiteField(siteIdx, 'endTime', e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-primary-400"
                    />
                    <button onClick={() => saveSiteEdit(siteIdx)} className="rounded p-1.5 text-green-600 hover:bg-green-50">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setSites((prev) => prev.map((s, i) => i === siteIdx ? { ...s, isEditing: false } : s))} className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-semibold text-gray-900">{site.name}</span>
                        {site.location && (
                          <span className="ml-2 text-sm text-primary-600 font-medium">{site.location}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {site.vehiclePlate && (() => {
                          const v = vehicles.find((v) => v.plate === site.vehiclePlate);
                          const isDraggingThis = draggingVehicle?.plate === site.vehiclePlate && draggingVehicleFromSiteIdx === siteIdx;
                          return (
                            <span
                              draggable
                              onDragStart={() => {
                                if (v) { setDraggingVehicle(v); setDraggingVehicleFromSiteIdx(siteIdx); }
                              }}
                              onDragEnd={() => { setDraggingVehicle(null); setDraggingVehicleFromSiteIdx(null); setDragOverSiteIdx(null); }}
                              className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 font-medium cursor-grab active:cursor-grabbing transition-opacity ${
                                isDraggingThis
                                  ? 'opacity-40 bg-amber-100 border-amber-300 text-amber-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}
                            >
                              <Car className="h-3 w-3" />
                              {site.vehiclePlate}
                              <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); clearVehicleFromSite(siteIdx); }}
                                className="ml-0.5 text-amber-400 hover:text-amber-700"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })()}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {site.startTime}–{site.endTime}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {site.assignments.length}
                      </span>
                      <button
                        onClick={() => setSites((prev) => prev.map((s, i) => i === siteIdx ? { ...s, isEditing: true } : s))}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteSiteIdx(siteIdx)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Assignments */}
                <div className="px-4 py-2 flex flex-wrap gap-2">
                  {site.assignments.map((a, empIdx) => (
                    <div key={a.employeeId} className="relative group">
                      {editingNote?.siteIdx === siteIdx && editingNote?.empIdx === empIdx ? (
                        <div className="flex items-center gap-1 rounded-full border border-primary-300 bg-primary-50 px-2 py-1">
                          <input
                            autoFocus
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                            placeholder="Notiz…"
                            className="w-32 text-xs bg-transparent border-none outline-none"
                          />
                          <button onClick={saveNote} className="text-green-600"><Check className="h-3 w-3" /></button>
                          <button onClick={() => setEditingNote(null)} className="text-gray-400"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div
                          draggable
                          onDragStart={() => { setDraggingEmployee(a.employee); setDraggingFromSiteIdx(siteIdx); setAssigningEmployee(null); }}
                          onDragEnd={() => { setDraggingEmployee(null); setDraggingFromSiteIdx(null); setDragOverSiteIdx(null); }}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm cursor-grab active:cursor-grabbing transition-opacity ${
                            draggingEmployee?.id === a.employeeId && draggingFromSiteIdx === siteIdx
                              ? 'opacity-40'
                              : absentEmployeeIds.has(a.employeeId)
                                ? 'border-red-200 bg-red-50'
                                : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50'
                          }`}
                          onClick={() => {
                            setEditingNote({ siteIdx, empIdx });
                            setNoteValue(a.note ?? '');
                          }}
                        >
                          <span className="font-medium text-gray-800">
                            {a.employee.firstName} {a.employee.lastName}
                          </span>
                          {a.note && (
                            <span className="text-xs text-gray-500 italic">({a.note})</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeAssignment(siteIdx, a.employeeId); }}
                            className="text-gray-300 hover:text-red-500 ml-1"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Assign button */}
                  {assigningEmployee ? (
                    <button
                      onClick={() => assignEmployee(assigningEmployee, siteIdx)}
                      className="flex items-center gap-1 rounded-full border-2 border-dashed border-primary-400 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 hover:bg-primary-100"
                    >
                      <Plus className="h-3 w-3" />
                      {assigningEmployee.firstName} {assigningEmployee.lastName} hier zuweisen
                    </button>
                  ) : (
                    site.assignments.length === 0 && (
                      <span className="text-xs text-gray-400 italic">Keine Mitarbeiter zugewiesen</span>
                    )
                  )}
                </div>
              </div>
              </Fragment>
            ))}

            {/* Add site */}
            {showNewSiteForm ? (
              <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 space-y-3">
                {/* Autocomplete */}
                <div className="relative" ref={autocompleteRef}>
                  <input
                    autoFocus
                    value={autocompleteQuery}
                    onChange={(e) => { setAutocompleteQuery(e.target.value); setNewSiteForm({ ...newSiteForm, name: e.target.value }); setShowAutocomplete(true); }}
                    onFocus={() => setShowAutocomplete(true)}
                    placeholder="Name der Baustelle…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {showAutocomplete && filteredWorkSites.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                      {filteredWorkSites.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => addSiteFromWorkSite(ws)}
                          className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 text-left"
                        >
                          <span className="font-medium">{ws.name}</span>
                          <span className="text-gray-500 flex items-center gap-2">
                            {ws.location && <span className="flex items-center gap-0.5 text-primary-600"><MapPin className="h-3 w-3" />{ws.location}</span>}
                            {ws.defaultVehiclePlate && <span className="flex items-center gap-0.5"><Car className="h-3 w-3" />{ws.defaultVehiclePlate}</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newSiteForm.location}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, location: e.target.value })}
                    placeholder="Ort (optional)"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    value={newSiteForm.vehiclePlate}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, vehiclePlate: e.target.value })}
                    placeholder="Kennzeichen (optional)"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    type="time"
                    value={newSiteForm.startTime}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, startTime: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    type="time"
                    value={newSiteForm.endTime}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, endTime: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addSiteFromForm}
                    className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    <Check className="h-4 w-4" /> Hinzufügen
                  </button>
                  <button
                    onClick={() => { setShowNewSiteForm(false); setAutocompleteQuery(''); setNewSiteForm({ name: '', location: '', vehiclePlate: '', startTime: '06:00', endTime: '16:00' }); }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewSiteForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Neue Baustelle
              </button>
            )}
          </div>

          {/* ── Right: Employee Pool + Absences ── */}
          <div className="w-64 shrink-0 space-y-4">
            {/* Mitarbeiter-Pool */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Mitarbeiter-Pool
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {poolEmployees.length}
                  </span>
                </h2>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {poolEmployees.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">Alle MA zugewiesen</p>
                ) : (
                  poolEmployees.map((emp) => {
                    const absType = absenceByEmployee.get(emp.id);
                    const isAssigning = assigningEmployee?.id === emp.id;
                    return (
                      <button
                        key={emp.id}
                        draggable
                        onDragStart={() => { setDraggingEmployee(emp); setDraggingFromSiteIdx(null); setAssigningEmployee(null); }}
                        onDragEnd={() => { setDraggingEmployee(null); setDraggingFromSiteIdx(null); setDragOverSiteIdx(null); }}
                        onClick={() => setAssigningEmployee(isAssigning ? null : emp)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-grab active:cursor-grabbing ${
                          isAssigning
                            ? 'bg-primary-100 border border-primary-400'
                            : draggingEmployee?.id === emp.id
                              ? 'opacity-50 border border-primary-300'
                              : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <span className="font-medium text-gray-800">
                          {emp.firstName} {emp.lastName}
                        </span>
                        {absType && (
                          <span className={`rounded-full px-1.5 py-0.5 text-xs ${ABSENCE_COLORS[absType]}`}>
                            {ABSENCE_LABELS[absType]}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              {assigningEmployee && (
                <div className="border-t border-primary-200 bg-primary-50 px-3 py-2">
                  <p className="text-xs text-primary-700">
                    Klick auf eine Baustelle um <strong>{assigningEmployee.firstName} {assigningEmployee.lastName}</strong> zuzuweisen
                  </p>
                  <button onClick={() => setAssigningEmployee(null)} className="mt-1 text-xs text-gray-400 hover:text-gray-600">
                    Abbrechen
                  </button>
                </div>
              )}
            </div>

            {/* Fahrzeugpool */}
            <div
              className={`rounded-lg border bg-white shadow-sm transition-colors ${
                draggingVehicle && draggingVehicleFromSiteIdx !== null
                  ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-50'
                  : 'border-amber-200'
              }`}
              onDragOver={(e) => { if (draggingVehicle && draggingVehicleFromSiteIdx !== null) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingVehicle && draggingVehicleFromSiteIdx !== null) {
                  clearVehicleFromSite(draggingVehicleFromSiteIdx);
                  setDraggingVehicle(null);
                  setDraggingVehicleFromSiteIdx(null);
                }
              }}
            >
              <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-amber-500" />
                  Fahrzeugpool
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {poolVehicles.length}
                  </span>
                </h2>
                <button
                  onClick={() => { setShowVehicleForm(true); setVehicleFormPlate(''); setVehicleFormDesc(''); setVehicleFormError(''); }}
                  className="rounded p-1 text-amber-600 hover:bg-amber-50"
                  title="Fahrzeug hinzufügen"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Add vehicle form */}
              {showVehicleForm && (
                <div className="border-b border-amber-100 px-3 py-2 bg-amber-50 space-y-2">
                  <input
                    autoFocus
                    value={vehicleFormPlate}
                    onChange={(e) => setVehicleFormPlate(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && addVehicle()}
                    placeholder="Kennzeichen (z.B. SB-552)"
                    className="w-full rounded border border-amber-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    value={vehicleFormDesc}
                    onChange={(e) => setVehicleFormDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addVehicle()}
                    placeholder="Beschreibung (optional)"
                    className="w-full rounded border border-amber-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  {vehicleFormError && <p className="text-xs text-red-600">{vehicleFormError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={addVehicle}
                      disabled={vehicleFormLoading}
                      className="flex items-center gap-1 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Speichern
                    </button>
                    <button
                      onClick={() => setShowVehicleForm(false)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                {poolVehicles.length === 0 ? (
                  <p className="py-3 text-center text-xs text-gray-400">
                    {vehicles.length === 0 ? 'Keine Fahrzeuge' : 'Alle Fahrzeuge im Einsatz'}
                  </p>
                ) : (
                  poolVehicles.map((v) => (
                    <div
                      key={v.id}
                      draggable
                      onDragStart={() => { setDraggingVehicle(v); setDragOverSiteIdx(null); }}
                      onDragEnd={() => { setDraggingVehicle(null); setDragOverSiteIdx(null); }}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-grab active:cursor-grabbing transition-opacity ${
                        draggingVehicle?.id === v.id
                          ? 'opacity-40 border-amber-300 bg-amber-50'
                          : 'border-amber-100 hover:bg-amber-50'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-gray-800">{v.plate}</span>
                        {v.description && (
                          <span className="ml-2 text-xs text-gray-500">{v.description}</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteVehicle(v.id)}
                        className="text-gray-300 hover:text-red-500"
                        title="Löschen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-amber-100 px-3 py-2">
                <p className="text-xs text-amber-600">Fahrzeug auf Baustelle ziehen zum Zuweisen</p>
              </div>
            </div>

            {/* Abwesenheiten */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-1.5">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Abwesenheiten</h2>
              {(['VACATION', 'SICK', 'SPECIAL', 'SCHOOL_BLOCK', 'SCHOOL'] as VacationType[]).map((type) => {
                const typeAbsences = absences.filter((a) => a.vacationType === type);
                const isHighlighted = dragOverAbsenceType === type && draggingEmployee !== null;
                return (
                  <div
                    key={type}
                    className={`flex flex-wrap gap-1 items-center rounded-md px-1.5 py-1 min-h-[26px] transition-colors ${
                      isHighlighted ? 'bg-red-50 ring-1 ring-red-300' : ''
                    }`}
                    onDragOver={(e) => { if (draggingEmployee) { e.preventDefault(); setDragOverAbsenceType(type); } }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverAbsenceType(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverAbsenceType(null);
                      if (draggingEmployee) {
                        const emp = draggingEmployee;
                        const fromSite = draggingFromSiteIdx;
                        const fromAbsenceId = draggingFromAbsenceId;
                        absenceDropHandledRef.current = true;
                        setDraggingEmployee(null);
                        setDraggingFromSiteIdx(null);
                        setDraggingFromAbsenceId(null);
                        if (fromAbsenceId) {
                          // Moving between absence type rows — delete old entry first
                          setAbsences((prev) => prev.filter((a) => a.id !== fromAbsenceId));
                          deleteAbsence(fromAbsenceId);
                        }
                        createAbsenceDirectly(emp, type, fromSite);
                      }
                    }}
                  >
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${ABSENCE_COLORS[type]}`}>
                      {ABSENCE_LABELS[type]}
                    </span>
                    {typeAbsences.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">
                        {isHighlighted ? 'Hier ablegen…' : '–'}
                      </span>
                    ) : (
                      typeAbsences.map((absence) => (
                        <span
                          key={absence.id}
                          draggable
                          onDragStart={() => {
                            setDraggingEmployee(absence.employee);
                            setDraggingFromSiteIdx(null);
                            setAssigningEmployee(null);
                            setDraggingFromAbsenceId(absence.id);
                            absenceDropHandledRef.current = false;
                          }}
                          onDragEnd={() => {
                            if (!absenceDropHandledRef.current) {
                              setAbsences((prev) => prev.filter((a) => a.id !== absence.id));
                              deleteAbsence(absence.id);
                            }
                            setDraggingEmployee(null);
                            setDraggingFromSiteIdx(null);
                            setDragOverSiteIdx(null);
                            setDraggingFromAbsenceId(null);
                            absenceDropHandledRef.current = false;
                          }}
                          className={`flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs cursor-grab active:cursor-grabbing transition-opacity ${
                            draggingFromAbsenceId === absence.id
                              ? 'opacity-40 border-red-200 bg-red-50'
                              : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50'
                          }`}
                          title="Auf Baustelle oder Abwesenheitstyp ziehen • Einfach wegziehen zum Löschen"
                        >
                          {absence.employee.firstName} {absence.employee.lastName}
                        </span>
                      ))
                    )}
                  </div>
                );
              })}
              <p className="mt-1 text-xs text-gray-400">MA in eine Zeile ziehen • Chip wegziehen zum Löschen</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation ──────────────────────────────────────── */}
      {deleteSiteIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Baustelle entfernen</h3>
            <p className="mt-2 text-sm text-gray-600">
              <strong>{sites[deleteSiteIdx]?.name}</strong> aus der Tagesplanung entfernen?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setDeleteSiteIdx(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={() => removeSite(deleteSiteIdx)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Entfernen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Area ────────────────────────────────────────────────── */}
      <div id="print-area" style={{ position: 'absolute', left: '-9999px', top: 0, width: '100%' }}>
        {/* Header */}
        <table style={{ width: '100%', marginBottom: 10, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', fontSize: 16 }}>Arbeiten am {formatDateDE(date)}</td>
              <td style={{ textAlign: 'right', fontSize: 11, color: '#555' }}>
                Gesamt: {allAssignedSorted.length} Mitarbeiter
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main table + right count list side by side */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ verticalAlign: 'top' }}>
              {/* Left: Baustellen table */}
              <td style={{ paddingRight: 16 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left', minWidth: 120 }}>Baustelle</th>
                      <th style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Fahrzeug</th>
                      <th style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>Beginn – Ende</th>
                      <th style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left', minWidth: 160 }}>Mitarbeiter</th>
                      <th style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center' }}>Anz.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site, idx) => {
                      const rowBorder = idx === 0 ? '1px solid #000' : '2px solid #444';
                      const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
                        border: '1px solid #000',
                        borderTop: rowBorder,
                        padding: '5px 8px',
                        verticalAlign: 'top',
                        ...extra,
                      });
                      return (
                        <tr key={site._tempId ?? site.id}>
                          <td style={cellStyle()}>
                            <div style={{ fontWeight: 'bold' }}>{site.name}</div>
                            {site.location && <div style={{ fontSize: 10, color: '#555' }}>{site.location}</div>}
                          </td>
                          <td style={cellStyle({ whiteSpace: 'nowrap' })}>
                            {site.vehiclePlate || '–'}
                          </td>
                          <td style={cellStyle({ whiteSpace: 'nowrap' })}>
                            {site.startTime} – {site.endTime}
                          </td>
                          <td style={cellStyle()}>
                            {site.assignments.map((a) => (
                              <div key={a.employeeId}>
                                {a.employee.lastName}, {a.employee.firstName[0]}.
                                {a.note ? <span style={{ color: '#666', fontSize: 9.5 }}> ({a.note})</span> : null}
                              </div>
                            ))}
                          </td>
                          <td style={cellStyle({ textAlign: 'center', fontWeight: 'bold' })}>
                            {site.assignments.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </td>

              {/* Right: numbered employee list */}
              <td style={{ verticalAlign: 'top', minWidth: 140 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>#</th>
                      <th style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'left' }}>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAssignedSorted.map((emp, i) => (
                      <tr key={emp.id}>
                        <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 6px' }}>{emp.lastName}, {emp.firstName[0]}.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Total box */}
                <div style={{ marginTop: 8, border: '2px solid #000', padding: '6px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#555' }}>Gesamt</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>{allAssignedSorted.length}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bottom: Absences */}
        <table style={{ borderCollapse: 'collapse', fontSize: 11, marginTop: 14, width: 'auto' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              {(['VACATION', 'SICK', 'SPECIAL', 'SCHOOL_BLOCK', 'SCHOOL'] as VacationType[]).map((t) => (
                <th key={t} style={{ border: '1px solid #000', padding: '3px 10px', minWidth: 80 }}>{ABSENCE_LABELS[t]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {(['VACATION', 'SICK', 'SPECIAL', 'SCHOOL_BLOCK', 'SCHOOL'] as VacationType[]).map((t) => (
                <td key={t} style={{ border: '1px solid #000', padding: '4px 10px', verticalAlign: 'top', minHeight: 30 }}>
                  {groupedAbsences[t].length === 0
                    ? <span style={{ color: '#aaa' }}>–</span>
                    : groupedAbsences[t].map((e) => <div key={e.id}>{e.lastName}</div>)
                  }
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
