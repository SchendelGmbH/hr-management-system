'use client';

import { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import axios from 'axios';
import { useSession } from 'next-auth/react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  position?: string;
  userId?: string | null;
}

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmployee: (userId: string) => void;
}

export function NewChatDialog({ isOpen, onClose, onSelectEmployee }: NewChatDialogProps) {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
    }
  }, [isOpen]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/employees');
      const data = response.data;
      // Die API gibt { employees: [...] } zurück
      const employeeList = data.employees || data;
      const filtered = employeeList.filter(
        (emp: Employee) => emp.id !== session?.user?.id
      );
      setEmployees(filtered);
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(query) ||
      emp.lastName.toLowerCase().includes(query) ||
      emp.employeeNumber.toLowerCase().includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Neuen Chat starten
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Mitarbeiter suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2" />
              Lade Mitarbeiter...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Keine Mitarbeiter gefunden
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => {
                    if (employee.userId) {
                      onSelectEmployee(employee.userId);
                      onClose();
                    }
                  }}
                  disabled={!employee.userId}
                  className={"w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left " + 
                    (employee.userId 
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800')
                  }
                >
                  <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {employee.position || employee.employeeNumber}
                      {!employee.userId && ' - (Kein Chat-Zugang)'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
