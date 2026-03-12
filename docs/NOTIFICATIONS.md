# Erweitertes Benachrichtigungs-System

## Übersicht

Dieses Modul bietet ein vollständiges Benachrichtigungssystem mit folgenden Features:

1. **Echtzeit-Benachrichtigungen** via Socket.IO
2. **Push-Benachrichtigungen** für Mobile/Desktop (Web Push API)
3. **Benachrichtigungseinstellungen pro User** (was, wann)
4. **Benachrichtigungs-Verlauf & Archiv**

## Architektur

### Datenbank-Modelle

- **Notification** - Gesendete Benachrichtigungen
- **NotificationSettings** - Globale Einstellungen pro User
- **NotificationTypeSettings** - Typ-spezifische Einstellungen
- **PushSubscription** - Web Push Subscriptions

### API-Routen

- `GET /api/notifications` - Benachrichtigungen abrufen (mit Pagination)
- `PATCH /api/notifications` - Als gelesen markieren / archivieren
- `DELETE /api/notifications?id={id}` - Löschen
- `GET /api/notifications/unread-count` - Ungelesene Zahl abrufen
- `GET /api/notifications/settings` - Einstellungen abrufen
- `PUT /api/notifications/settings` - Einstellungen speichern
- `POST /api/notifications/push/subscribe` - Push abonnieren
- `DELETE /api/notifications/push/subscribe` - Push kündigen

### Socket.IO Events

**Client → Server:**
- `subscribe-notifications` - Abonniert Benachrichtigungen
- `notification:mark-read` - Markiert eine Benachrichtigung als gelesen
- `notification:mark-all-read` - Markiert alle als gelesen
- `notification:get-unread-count` - Ruft ungelesene Zahl ab

**Server → Client:**
- `notification:new` - Neue Benachrichtigung
- `notification:unread-count` - Aktualisierte ungelesene Zahl
- `notification:all-read` - Alle als gelesen markiert
- `push:trigger` - Push-Benachrichtigung anzeigen

## Verwendung

### React Hook

```tsx
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  const { 
    notifications, 
    unreadCount,
    markAsRead, 
    markAllAsRead,
    archiveNotification,
    deleteNotification,
  } = useNotifications();

  return (
    <div>
      <p>{unreadCount} ungelesene Benachrichtigungen</p>
      {notifications.map(n => (
        <div key={n.id} onClick={() => markAsRead(n.id)}>
          {n.title}
        </div>
      ))}
    </div>
  );
}
```

### Push-Benachrichtigungen

```tsx
import { usePushNotifications } from '@/hooks/usePushNotifications';

function NotificationsSettings() {
  const { subscribe, unsubscribe, isSupported, permission } = usePushNotifications();

  return (
    <button onClick={subscribe}>
      Push-Benachrichtigungen aktivieren
    </button>
  );
}
```

### Benachrichtigung senden (Server)

```ts
import { sendNotification } from '@/lib/notifications';

await sendNotification({
  userId: 'user-123',
  type: 'TASK_ASSIGNED',
  title: 'Neue Aufgabe',
  message: 'Ihnen wurde eine Aufgabe zugewiesen',
  priority: 'HIGH',
  actionUrl: '/tasks/123',
});
```

## Konfiguration

### Umgebungsvariablen

```env
# Für Push-Benachrichtigungen (optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# Für Cron-Jobs (optional)
CRON_SECRET=your_cron_secret
```

### VAPID-Schlüssel generieren

```bash
npx web-push generate-vapid-keys
```

## Cron-Job einrichten

Rufe täglich auf für Cleanup:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.com/api/cron/notifications/cleanup
```

## Features

### Do Not Disturb
- Zeitraum festlegbar (z.B. 22:00 - 07:00)
- Nur DRINGENDE Benachrichtigungen durchlassen

### Ruhezeit (Quiet Hours)
- Ton deaktiviert
- Benachrichtigungen werden weiterhin angezeigt

### Typ-spezifische Einstellungen
- Pro Benachrichtigungstyp konfigurierbar
- Kanäle: In-App, Push, E-Mail, SMS
- Prioritäten: Niedrig, Normal, Hoch, Dringend
- Stummschaltung möglich (auch temporär)

### Archivierung
- Benachrichtigungen werden nach 30 Tagen archiviert
- Nach 90 Tagen gelöscht (via Cron)

## Mobile Unterstützung

- **iOS**: Begrenzte Web Push Unterstützung (iOS 16.4+)
- **Android**: Vollständige Web Push Unterstützung
- **Desktop Chrome/Edge/Firefox**: Vollständige Unterstützung

## Service Worker

Der Service Worker (`public/service-worker.js`):
- Empfängt Push-Nachrichten im Hintergrund
- Zeigt Native Notifications an
- Handhabt Klicks auf Benachrichtigungen

## Fehlerbehebung

**Benachrichtigungen werden nicht empfangen:**
1. Prüfe Socket.IO Verbindung
2. Prüfe Browser-Berechtigungen für Benachrichtigungen
3. Prüfe Service Worker Registrierung

**Push funktioniert nicht:**
1. VAPID-Schlüssel korrekt konfiguriert?
2. HTTPS für die Domain aktiviert?
3. Service Worker registriert?

## Roadmap

- [ ] Native Mobile Apps (iOS/Android)
- [ ] Rich Notifications mit Bildern
- [ ] E-Mail Benachrichtigungen
- [ ] SMS Benachrichtigungen
- [ ] Benachrichtigungs-Templates