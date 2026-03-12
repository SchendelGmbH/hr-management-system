/**
 * My Schedule Seite - Persönlicher Schichtplan mit Tausch-Funktion
 */

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShiftCalendarView } from '@/components/swaps/ShiftCalendarView';
import { InformationCircleIcon, ArrowRightLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export const metadata = {
  title: 'Mein Schichtplan | HR Management',
  description: 'Persönlicher Schichtplan mit Tausch-Funktion',
};

export default async function MySchedulePage() {
  const user = await requireAuth();

  if (!user?.employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Zugriff verweigert
          </h1>
          <p className="text-gray-500">
            Sie benötigen Mitarbeiter-Berechtigungen.
          </p>
        </div>
      </div>
    );
  }

  // Zähle ausstehende Swap-Anfragen
  const pendingSwaps = await prisma.shiftSwap.count({
    where: {
      OR: [
        { requesterId: user.employee.id, status: 'PENDING' },
        { requestedEmployeeId: user.employee.id, status: 'PENDING' },
      ],
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white">
                <ArrowRightLeftIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Mein Schichtplan
                </h1>
                <p className="text-gray-500">
                  Ihre zugewiesenen Schichten mit Tausch-Option
                </p>
              </div>
            </div>

            <Link
              href="/de/swaps"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ArrowRightLeftIcon className="w-4 h-4" />
              <span>Tausch-Anfragen ({pendingSwaps})</span>
            </Link>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800">
              <p>
                <strong>Tauschen Sie Ihre Schicht:</strong> Klicken Sie auf das Tausch-Icon 
                <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full mx-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </span>
                neben Ihrer Schicht, um einen Tauschpartner zu finden.
              </p>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <ShiftCalendarView employeeId={user.employee.id} />
      </div>
    </div>
  );
}
