/**
 * Schicht-Tausch Seite
 * Übersicht aller Tauschanfragen und Möglichkeit neue zu erstellen
 */

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SwapRequestsOverview } from '@/components/swaps/SwapRequestsOverview';
import { ArrowRightLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

export const metadata = {
  title: 'Schicht-Tausch | HR Management',
  description: 'Verwalten Sie Ihre Schichttausch-Anfragen',
};

export default async function SwapsPage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
              <ArrowRightLeftIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Schicht-Tausch
              </h1>
              <p className="text-gray-500">
                Verwalten Sie Ihre Schichttausch-Anfragen
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p>
                <strong>Wie funktioniert der Schicht-Tausch?</strong>
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Klicken Sie im Kalender auf das Tausch-Icon neben Ihrer Schicht</li>
                <li>Wählen Sie einen verfügbaren Tauschpartner aus</li>
                <li>Senden Sie die Anfrage und warten Sie auf Genehmigung</li>
                <li>Nach Genehmigung werden die Schichten automatisch getauscht</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Content */}
        <SwapRequestsOverview employeeId={user.employee.id} />
      </div>
    </div>
  );
}
