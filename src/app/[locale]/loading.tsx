import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-9 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="h-6 w-56 animate-pulse rounded bg-gray-200" />
        </div>
        <TableSkeleton
          rows={5}
          headers={['Mitarbeiter', 'Kategorien', 'Ablaufdatum', 'Tage bis Ablauf', 'Status']}
        />
      </div>
    </div>
  );
}
