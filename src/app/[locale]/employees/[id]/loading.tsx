import { ArrowLeft } from 'lucide-react';
import { DetailFormSkeleton } from '@/components/ui/Skeleton';

export default function EmployeeDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button disabled className="flex items-center gap-2 text-sm text-gray-500 opacity-60">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </button>
          <div>
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="mt-1 h-4 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {['Stammdaten', 'Dokumente', 'Arbeitskleidung', 'Urlaube'].map((tab) => (
            <div
              key={tab}
              className="border-b-2 border-transparent px-1 pb-4 pt-2 text-sm font-medium text-gray-400"
            >
              {tab}
            </div>
          ))}
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="space-y-6">
        {/* Section title */}
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <DetailFormSkeleton rows={10} />
      </div>
    </div>
  );
}
