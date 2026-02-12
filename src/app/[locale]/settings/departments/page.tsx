'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus } from 'lucide-react';
import Link from 'next/link';
import AddDepartmentModal from '@/components/departments/AddDepartmentModal';

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/de/settings" className="text-sm text-primary-600 hover:text-primary-700">
            ← Zurück zu Einstellungen
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
              <div className="flex items-start space-x-3">
                <div className="rounded-lg bg-primary-100 p-2">
                  <Building2 className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                  {dept.description && (
                    <p className="mt-1 text-sm text-gray-600">{dept.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
