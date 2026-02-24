// Reusable skeleton loading components using Tailwind animate-pulse

export function SkeletonLine({ className = 'w-full' }: { className?: string }) {
  return <div className={`h-4 animate-pulse rounded bg-gray-200 ${className}`} />;
}

export function SkeletonCircle({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
  return <div className={`animate-pulse rounded-full bg-gray-200 ${sizes[size]}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-3 flex-1">
          <SkeletonLine className="w-32" />
          <SkeletonLine className="w-16 h-8" />
        </div>
        <div className="ml-4 h-12 w-12 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          {i === 1 ? (
            // Second column often has avatar + text pattern
            <div className="flex items-center gap-3">
              <SkeletonCircle />
              <div className="space-y-2">
                <SkeletonLine className="w-24" />
                <SkeletonLine className="w-16" />
              </div>
            </div>
          ) : (
            <SkeletonLine className={i === 0 ? 'w-16' : i % 3 === 0 ? 'w-20' : 'w-28'} />
          )}
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
  headers,
}: {
  rows?: number;
  cols?: number;
  headers?: string[];
}) {
  const colCount = headers ? headers.length : cols;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        {headers && (
          <thead className="bg-gray-50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-gray-200 bg-white">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={colCount} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DetailFormSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine className="w-24" />
          <div className="h-9 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
