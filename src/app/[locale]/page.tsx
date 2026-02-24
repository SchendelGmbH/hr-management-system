import { Suspense } from 'react';
import { Users, FileText, Calendar, AlertCircle } from 'lucide-react';
import prisma from '@/lib/prisma';
import { daysUntil } from '@/lib/utils';
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

// --- Separate async components so they stream independently ---

async function DashboardStats() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalEmployees, expiredDocuments, expiringSoonCount, upcomingVacations] =
    await Promise.all([
      prisma.employee.count(),
      prisma.document.count({
        where: { isContainer: true, expirationDate: { lt: now } },
      }),
      prisma.document.count({
        where: { isContainer: true, expirationDate: { gte: now, lte: in30Days } },
      }),
      prisma.vacation.count({
        where: { startDate: { gte: now, lte: in7Days } },
      }),
    ]);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Mitarbeiter gesamt</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totalEmployees}</p>
          </div>
          <div className="rounded-lg bg-primary-100 p-3">
            <Users className="h-6 w-6 text-primary-600" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Abgelaufene Dokumente</p>
            <p className="mt-2 text-3xl font-bold text-red-600">{expiredDocuments}</p>
          </div>
          <div className="rounded-lg bg-red-100 p-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Läuft bald ab</p>
            <p className="mt-2 text-3xl font-bold text-orange-600">{expiringSoonCount}</p>
          </div>
          <div className="rounded-lg bg-orange-100 p-3">
            <FileText className="h-6 w-6 text-orange-600" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Anstehende Urlaube</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{upcomingVacations}</p>
          </div>
          <div className="rounded-lg bg-blue-100 p-3">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function ExpiringDocumentsTable() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiringSoon = await prisma.document.findMany({
    where: {
      isContainer: true,
      expirationDate: { gte: now, lte: in30Days },
    },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
      categories: { include: { category: true } },
    },
    orderBy: { expirationDate: 'asc' },
    take: 5,
  });

  if (expiringSoon.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Keine ablaufenden Dokumente</h3>
        <p className="mt-2 text-sm text-gray-500">
          Alle Dokumente sind aktuell und es gibt keine Fristen in den nächsten 30 Tagen.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Bald ablaufende Dokumente</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Mitarbeiter
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Kategorien
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Ablaufdatum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Tage bis Ablauf
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {expiringSoon.map((doc) => {
              const days = doc.expirationDate ? daysUntil(doc.expirationDate) : 0;
              const statusColor =
                days <= 7
                  ? 'bg-red-100 text-red-800'
                  : days <= 14
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-yellow-100 text-yellow-800';

              return (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {doc.employee.firstName} {doc.employee.lastName}
                    <div className="text-xs text-gray-500">{doc.employee.employeeNumber}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex flex-wrap gap-1">
                      {doc.categories && doc.categories.length > 0
                        ? doc.categories.map((dc: any) => (
                            <span
                              key={dc.category.id}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ backgroundColor: `${dc.category.color}20`, color: dc.category.color }}
                            >
                              {dc.category.name}
                            </span>
                          ))
                        : '-'}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {doc.expirationDate
                      ? new Date(doc.expirationDate).toLocaleDateString('de-DE')
                      : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{days} Tage</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                      {days <= 7 ? 'Kritisch' : days <= 14 ? 'Dringend' : 'Bald'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Page shell renders immediately, data streams in ---

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">Übersicht über Ihr HR Management System</p>
      </div>

      {/* Stats stream in independently */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        }
      >
        <DashboardStats />
      </Suspense>

      {/* Expiring docs table streams in independently */}
      <Suspense
        fallback={
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="h-6 w-56 animate-pulse rounded bg-gray-200" />
            </div>
            <TableSkeleton rows={5} headers={['Mitarbeiter', 'Kategorien', 'Ablaufdatum', 'Tage bis Ablauf', 'Status']} />
          </div>
        }
      >
        <ExpiringDocumentsTable />
      </Suspense>
    </div>
  );
}
