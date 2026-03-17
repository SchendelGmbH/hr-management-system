# Toast-Benachrichtigungs-System

## Übersicht
Ein flexibles Toast-System für Push-Benachrichtigungen im HR Management System.

## Features
- 🔔 **4 Toast-Typen**: Info, Success, Warning, Error
- ⏱️ **Auto-Dismiss**: Mit Fortschrittsbalken
- 💬 **Chat-Integration**: Spezielle Chat-Benachrichtigungen
- 🔔 **System-Benachrichtigungen**: Für alle Module
- 🖱️ **Klickbar**: Toasts können Aktionen auslösen
- 📱 **Browser Notifications**: Optional

## Dateien

### 1. Hook: `src/hooks/useToast.ts`
Basis-Hook für Toast-Verwaltung.

```typescript
const { toasts, addToast, removeToast } = useToast();

// Toast hinzufügen
addToast({
  title: 'Erfolg!',
  message: 'Aktion erfolgreich',
  type: 'success',
  duration: 5000 // ms
});
```

### 2. Komponenten: `src/components/ui/Toast.tsx`
- `ToastContainer`: Container für alle Toasts (unten rechts)
- `ToastItem`: Einzelner Toast mit Animation
- `ChatToast`: Speziell für Chat-Nachrichten
- `NotificationToast`: Für System-Benachrichtigungen

### 3. Provider: `src/components/providers/ToastProvider.tsx`
Globaler Provider für die App.

```typescript
// In layout.tsx
import { ToastProvider } from '@/components/providers/ToastProvider';

export default function Layout({ children }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
```

### 4. Notification Hooks: `src/hooks/useNotifications.ts`
Spezialisierte Hooks für verschiedene Benachrichtigungen:
- `useChatNotifications()`: Für Chat-Nachrichten
- `useSystemNotifications()`: Für System-Benachrichtigungen
- `useSwapNotifications()`: Für Schichttausch

## Verwendung

### Einfacher Toast
```typescript
import { useToastContext } from '@/components/providers/ToastProvider';

function MyComponent() {
  const { info, success, warning, error } = useToastContext();

  const handleSave = () => {
    success('Gespeichert!', 'Die Daten wurden gespeichert.');
  };

  const handleError = () => {
    error('Fehler!', 'Etwas ist schiefgelaufen.');
  };

  return (
    <button onClick={handleSave}>Speichern</button>
  );
}
```

### Chat-Benachrichtigungen aktivieren
```typescript
import { useChatNotifications } from '@/hooks/useNotifications';

function DashboardPage() {
  useChatNotifications(); // Automatisch bei neuen Nachrichten
  
  return <div>Dashboard</div>;
}
```

### Manuelle Chat-Benachrichtigung
```typescript
const { addToast } = useToastContext();

// Bei neuer Chat-Nachricht
addToast({
  title: 'Max Mustermann in Allgemein',
  message: 'Hallo, wie geht es dir?',
  type: 'info',
  duration: 8000
});
```

## Positionierung
Die Toasts werden automatisch **unten rechts** angezeigt:
- Fixed Position: `bottom-4 right-4`
- Z-Index: 9999 (immer im Vordergrund)
- Max-Width: `max-w-sm` (384px)

## Animationen
- **Slide-In**: Von rechts nach links (300ms)
- **Slide-Out**: Nach rechts raus (300ms)
- **Progress-Bar**: Zeigt verbleibende Zeit an

## Browser Notifications
Für Chat-Nachrichten werden auch Browser-Notifications angezeigt (wenn erlaubt).

## Integration
1. `ToastProvider` in `layout.tsx` einfügen
2. `useChatNotifications()` in Dashboard/Layout aktivieren
3. `useToastContext()` für manuelle Toasts verwenden

## Beispiel-Implementierung
Siehe `src/components/toast-example.tsx`
