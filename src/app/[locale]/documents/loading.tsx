import { Plus } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';

export default function DocumentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dokumente</h1>
          <p className="mt-2 text-sm text-gray-600">Dokumentenmanagement mit Ablaufverfolgung</p>
        </div>
        <button
          disabled
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white opacity-60"
        >
          <Plus className="h-5 w-5" />
          <span>Dokument hochladen</span>
        </button>
      </div>

      {/* Filter Skeleton */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {[80, 64, 104, 80].map((w, i) => (
            <div key={i} className={`h-9 w-${w === 80 ? '20' : w === 64 ? '16' : w === 104 ? '28' : '20'} animate-pulse rounded-lg bg-gray-200`} style={{ width: w }} />
          ))}
        </div>
        <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-100" />
        <div className="flex gap-2">
          {[72, 96, 88, 80].map((w, i) => (
            <div key={i} className="h-9 animate-pulse rounded-full bg-gray-100" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <TableSkeleton
          rows={8}
          headers={['Version', 'Mitarbeiter', 'Kategorien', 'Titel', 'Gültig ab', 'Ablaufdatum', 'Tage', 'Status', 'Aktionen']}
        />
      </div>
    </div>
  );
}
