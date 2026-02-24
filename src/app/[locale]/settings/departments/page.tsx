'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import AddDepartmentModal from '@/components/departments/AddDepartmentModal';

interface Department {
  id: string;
  name: string;
  description: string | null;
  _count: { employees: number };
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      const data = await response.json();
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/departments/${dept.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Fehler beim Löschen');
        return;
      }
      setDeleteConfirm(null);
      fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Fehler beim Löschen der Abteilung');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">
            &larr; Zurück zu Einstellungen
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Abteilungen</h1>
          <p className="mt-2 text-sm text-gray-600">Verwalten Sie Ihre Abteilungen</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          <span>Neue Abteilung</span>
        </button>
      </div>

      <AddDepartmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchDepartments}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-3 flex h-64 items-center justify-center">
            <div className="text-gray-500">Laden...</div>
          </div>
        ) : departments.length === 0 ? (
          <div className="col-span-3 flex h-64 flex-col items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Abteilungen</h3>
          </div>
        ) : (
          departments.map((dept) => (
            <div
              key={dept.id}
              className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="rounded-lg bg-primary-100 p-2">
                    <Building2 className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                    {dept.description && (
                      <p className="mt-1 text-sm text-gray-600">{dept.description}</p>
                    )}
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <Users className="mr-1 h-3.5 w-3.5" />
                      {dept._count.employees} Mitarbeiter
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirm(dept)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Abteilung löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Abteilung löschen</h3>
            <p className="mt-2 text-sm text-gray-600">
              Möchten Sie die Abteilung <strong>{deleteConfirm.name}</strong> wirklich löschen?
            </p>
            {deleteConfirm._count.employees > 0 && (
              <p className="mt-2 text-sm text-red-600">
                Diese Abteilung hat {deleteConfirm._count.employees} zugeordnete Mitarbeiter und kann nicht gelöscht werden. Ordnen Sie die Mitarbeiter zuerst einer anderen Abteilung zu.
              </p>
            )}
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
                disabled={deleting || deleteConfirm._count.employees > 0}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Wird gelöscht...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
