// In deinem Root Layout (app/layout.tsx oder app/[locale]/layout.tsx)

import { ToastProvider } from '@/components/providers/ToastProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

// In einer Page-Komponente (z.B. Dashboard)

'use client';

import { useToastContext } from '@/components/providers/ToastProvider';
import { useChatNotifications } from '@/hooks/useNotifications';

export default function DashboardPage() {
  const { info, success, warning, error } = useToastContext();
  
  // Aktiviert Chat-Benachrichtigungen
  useChatNotifications();

  const handleAction = () => {
    // Manuelle Toast-Benachrichtigung
    success('Erfolg!', 'Die Aktion wurde erfolgreich durchgeführt.');
  };

  const handleError = () => {
    error('Fehler!', 'Etwas ist schiefgelaufen.');
  };

  return (
    <div>
      <button onClick={handleAction}>
        Erfolg zeigen
      </button>
      <button onClick={handleError}>
        Fehler zeigen
      </button>
    </div>
  );
}
