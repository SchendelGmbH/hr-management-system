'use client';

import { NotificationBell } from '@/components/notifications';

export default function NotificationsPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Benachrichtigungen</h1>
          <NotificationBell />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Verwalten Sie Ihre Benachrichtigungen über die Glocke oben rechts.
            <br />
            <br />
            <strong>Features:</strong>
          </p>
          
          <ul className="list-disc list-inside mt-4 space-y-2">
            <li>Echtzeit-Benachrichtigungen via Socket.IO</li>
            <li>Push-Benachrichtigungen für Mobile/Desktop</li>
            <li>Benachrichtigungseinstellungen pro Typ</li>
            <li>Archivierung und Verlauf</li>
            <li>Ruhezeit- und Nicht-Stören-Modus</li>
          </ul>

          <div className="mt-6">
            <a
              href="/notifications/settings"
              className="text-blue-600 hover:underline"
            >
              → Zu den Einstellungen
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}