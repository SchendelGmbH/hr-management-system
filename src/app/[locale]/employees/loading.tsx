import { UserPlus } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';

export default function EmployeesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mitarbeiter</h1>
          <p className="mt-2 text-sm text-gray-600">Mitarbeiterverwaltung</p>
        </div>
        <button
          disabled
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white opacity-60"
        >
          <UserPlus className="h-5 w-5" />
          <span>Neuer Mitarbeiter</span>
        </button>
      </div>

      {/* Search / Filter Skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-100" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <TableSkeleton
          rows={8}
          headers={['Mitarbeiter-Nr.', 'Name', 'Abteilung', 'Position', 'E-Mail', 'Eintrittsdatum']}
        />
      </div>
    </div>
  );
}
