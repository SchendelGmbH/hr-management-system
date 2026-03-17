/**
 * My Schedule Seite - Persönlicher Schichtplan mit Tausch-Funktion
 */

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShiftCalendarView } from '@/components/swaps/ShiftCalendarView';
import { ArrowLeftRight, Info, Lock } from 'lucide-react';
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

  // Prüfe ob das calendar Modul aktiv ist
  const calendarModule = await prisma.systemModule.findFirst({
    where: { key: 'calendar', isActive: true },
  });

  // Wenn Modul deaktiviert, zeige gesperrte Ansicht
  if (!calendarModule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Modul gesperrt
          </h1>
          <p className="text-gray-600">
            Dieses Modul ist deaktiviert.
          </p>
        </div>
      </div>
    );
  }

  // Prüfe Schichttausch-Einstellungen
  const shiftSwapSetting = await prisma.systemSetting.findUnique({
    where: { key: 'shiftSwap.mode' },
  });
  
  const shiftSwapMode = shiftSwapSetting?.value || 'allowed';
  const shiftSwapAllowed = shiftSwapMode !== 'forbidden';

  // Zähle ausstehende Swap-Anfragen (nur wenn erlaubt)
  const pendingSwaps = shiftSwapAllowed 
    ? await prisma.shiftSwap.count({
        where: {
          OR: [
            { requesterId: user.employee.id, status: 'PENDING' },
            { requestedEmployeeId: user.employee.id, status: 'PENDING' },
          ],
        },
      })
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Mein Schichtplan
                </h1>
                <p className="text-gray-500">
                  Ihre zugewiesenen Schichten{shiftSwapAllowed ? ' mit Tausch-Option' : ''}
                </p>
              </div>
            </div>

            {/* Tausch-Anfragen Button - nur wenn erlaubt */}
            {shiftSwapAllowed && (
              <Link
                href="/de/swaps"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Tausch-Anfragen ({pendingSwaps})</span>
              </Link>
            )}
          </div>

          {/* Info Box - nur wenn Tausch erlaubt */}
          {shiftSwapAllowed && (
            <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
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
                {shiftSwapMode === 'approval_required' && (
                  <p className="mt-2 text-amber-700">
                    <strong>Hinweis:</strong> Tauschanfragen müssen von einem Admin genehmigt werden.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calendar */}
        <ShiftCalendarView employeeId={user.employee.id} />
      </div>
    </div>
  );
}
