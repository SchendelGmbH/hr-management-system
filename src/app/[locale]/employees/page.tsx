'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus, User, Edit, Trash2, LayoutList, LayoutGrid, Mail, Phone, Building2, Briefcase, Calendar } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  startDate: string | null;
  clothingBudget: number;
  remainingBudget: number;
  department: {
    id: string;
    name: string;
  } | null;
}

interface Department {
  id: string;
  name: string;
}

type ViewMode = 'list' | 'card';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Persist view mode in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('employees-view-mode') as ViewMode | null;
    if (stored === 'card' || stored === 'list') setViewMode(stored);
  }, []);

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('employees-view-mode', mode);
  };

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, [search, selectedDepartment, page]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
        ...(selectedDepartment && { departmentId: selectedDepartment }),
      });

      const response = await fetch(`/api/employees?${params}`);
      const data = await response.json();

      setEmployees(data.employees || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleDelete = async (employee: Employee) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Fehler beim Löschen');
      }
      setDeleteConfirm(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Fehler beim Löschen des Mitarbeiters');
    } finally {
      setDeleting(false);
    }
  };

  const initials = (emp: Employee) =>
    `${emp.lastName.charAt(0)}${emp.firstName.charAt(0)}`.toUpperCase();

  const emptyState = (
    <div className="flex h-64 flex-col items-center justify-center">
      <User className="h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Mitarbeiter gefunden</h3>
      <p className="mt-2 text-sm text-gray-500">
        {search || selectedDepartment
          ? 'Versuchen Sie, die Filter zu ändern'
          : 'Erstellen Sie Ihren ersten Mitarbeiter'}
      </p>
    </div>
  );

  const pagination = totalPages > 1 && (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Zurück
        </button>
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Weiter
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          Seite <span className="font-medium">{page}</span> von{' '}
          <span className="font-medium">{totalPages}</span>
        </p>
        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            ←
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            →
          </button>
        </nav>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mitarbeiter</h1>
          <p className="mt-2 text-sm text-gray-600">Verwalten Sie alle Mitarbeiter-Stammdaten</p>
        </div>
        <Link
          href="/de/employees/new"
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          <span>Neuer Mitarbeiter</span>
        </Link>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-col space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Nach Name, Email oder Nummer suchen..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Department Filter */}
        <div className="w-full sm:w-64">
          <select
            value={selectedDepartment}
            onChange={(e) => { setSelectedDepartment(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Alle Abteilungen</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex shrink-0 items-center rounded-lg border border-gray-200 p-0.5">
          <button
            onClick={() => toggleViewMode('list')}
            className={`rounded-md p-2 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            title="Listenansicht"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleViewMode('card')}
            className={`rounded-md p-2 transition-colors ${viewMode === 'card' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            title="Kartenansicht"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <TableSkeleton
              rows={8}
              headers={['Mitarbeiter-Nr.', 'Name', 'Abteilung', 'Position', 'E-Mail', 'Eintrittsdatum']}
            />
          ) : employees.length === 0 ? emptyState : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Mitarbeiter-Nr.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Abteilung</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Eintrittsdatum</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Kleidungsbudget</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => (window.location.href = `/de/employees/${employee.id}`)}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-primary-600">
                        {employee.employeeNumber}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                            <span className="text-sm font-medium text-primary-600">{initials(employee)}</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.lastName} {employee.firstName}
                            </div>
                            {employee.phone && (
                              <div className="text-sm text-gray-500">{employee.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{employee.department?.name || '-'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{employee.position || '-'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{employee.email || '-'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {employee.startDate ? formatDate(employee.startDate) : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="font-medium text-gray-900">{formatCurrency(employee.remainingBudget)}</div>
                        <div className="text-xs text-gray-500">von {formatCurrency(employee.clothingBudget)}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/de/employees/${employee.id}?edit=true`); }}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                            title="Bearbeiten"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(employee); }}
                            className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pagination}
        </div>
      )}

      {/* ── CARD VIEW ── */}
      {viewMode === 'card' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-gray-200" />
                    <div className="h-3 w-2/3 rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">{emptyState}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => router.push(`/de/employees/${employee.id}`)}
                    className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:border-primary-300"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-base font-semibold">
                          {initials(employee)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {employee.lastName} {employee.firstName}
                          </p>
                          <p className="text-xs font-medium text-primary-600">{employee.employeeNumber}</p>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/de/employees/${employee.id}?edit=true`); }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          title="Bearbeiten"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(employee); }}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="mt-4 space-y-1.5">
                      {employee.department && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">{employee.department.name}</span>
                        </div>
                      )}
                      {employee.position && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Briefcase className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">{employee.position}</span>
                        </div>
                      )}
                      {employee.email && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">{employee.email}</span>
                        </div>
                      )}
                      {employee.phone && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{employee.phone}</span>
                        </div>
                      )}
                      {employee.startDate && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{formatDate(employee.startDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Budget bar */}
                    {employee.clothingBudget > 0 && (
                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                          <span>Kleidungsbudget</span>
                          <span className="font-medium text-gray-600">
                            {formatCurrency(employee.remainingBudget)} / {formatCurrency(employee.clothingBudget)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-primary-400"
                            style={{ width: `${Math.min(100, (employee.remainingBudget / employee.clothingBudget) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination below cards */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm text-gray-700">
                    Seite <span className="font-medium">{page}</span> von{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center rounded-l-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center rounded-r-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                    >
                      →
                    </button>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Mitarbeiter löschen</h3>
            <p className="mt-2 text-sm text-gray-600">
              Möchten Sie <strong>{deleteConfirm.lastName} {deleteConfirm.firstName}</strong> ({deleteConfirm.employeeNumber}) wirklich löschen?
            </p>
            <p className="mt-2 text-sm text-red-600">
              Achtung: Alle zugehörigen Dokumente, Bestellungen und Urlaubsdaten werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Wird gelöscht...' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
