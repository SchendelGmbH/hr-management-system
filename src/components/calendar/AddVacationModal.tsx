'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { VertretungVorschlaege } from '@/components/vertretung/VertretungVorschlaege';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: {
    name: string;
  } | null;
}

interface AddVacationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddVacationModal({
  isOpen,
  onClose,
  onSuccess,
}: AddVacationModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVertretung, setShowVertretung] = useState(false);
  const [savedVacation, setSavedVacation] = useState<{employeeId: string; startDate: string; endDate: string; vacationType: string} | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    vacationType: 'VACATION',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create vacation');
      }

      // Bei Krankmeldung: Zeige Vertretungs-Finder
      if (formData.vacationType === 'SICK') {
        setSavedVacation({
          employeeId: formData.employeeId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          vacationType: formData.vacationType,
        });
        setShowVertretung(true);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating vacation:', error);
      alert('Fehler beim Erstellen des Urlaubs');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      startDate: '',
      endDate: '',
      vacationType: 'VACATION',
      notes: '',
    });
  };

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Neue Abwesenheit" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mitarbeiter *
          </label>
          <select
            required
            value={formData.employeeId}
            onChange={(e) =>
              setFormData({ ...formData, employeeId: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            <option value="">Bitte wählen...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employeeNumber} - {employee.firstName} {employee.lastName}
                {employee.department && ` (${employee.department.name})`}
              </option>
            ))}
          </select>
        </div>

        {/* Vacation Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Abwesenheitsart *
          </label>
          <select
            required
            value={formData.vacationType}
            onChange={(e) =>
              setFormData({ ...formData, vacationType: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            <option value="VACATION">Urlaub</option>
            <option value="SICK">Krankheit</option>
            <option value="SPECIAL">Sonderurlaub</option>
            <option value="SCHOOL">Berufsschule</option>
            <option value="SCHOOL_BLOCK">UBL – Blockwoche</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Startdatum *
          </label>
          <input
            type="date"
            required
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Enddatum *
          </label>
          <input
            type="date"
            required
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            min={formData.startDate}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Days Calculation */}
        {formData.startDate && formData.endDate && (
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">
              Anzahl Tage: {calculateDays()}
            </p>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Notizen
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Wird erstellt...' : formData.vacationType === 'SICK' ? 'Speichern & Vertretung suchen →' : 'Erstellen'}
          </button>
        </div>
      </form>

      {/* Vertretung-Finder Overlay */}
      {showVertretung && savedVacation && (
        <div className="mt-6 border-t pt-6">
          <VertretungVorschlaege
            krankerMitarbeiterId={savedVacation.employeeId}
            startDatum={savedVacation.startDate}
            endDatum={savedVacation.endDate}
            onClose={() => {
              setShowVertretung(false);
              setSavedVacation(null);
              onSuccess();
              onClose();
              resetForm();
            }}
          />
        </div>
      )}
    </Modal>
  );
}
