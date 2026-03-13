# Chat-Suche Feature

## Überblick

Dieses Feature fügt eine globale Chat-Suchfunktionalität hinzu, die es Benutzern ermöglicht, schnell Nachrichten, Räume und Kontakte zu finden.

## Features

### 1. Globaler Such-Zugang (Cmd+K / Strg+K)
- **Datei**: `src/components/chat/ChatSearch.tsx`
- Ein schwebender Button rechts unten auf dem Bildschirm
- Globaler Keyboard-Shortcut öffnet die Suche von überall
- Responsive Design für Mobile und Desktop

### 2. Suche nach Nachrichten
- **API**: `src/app/api/chat/search/route.ts`
- Volltextsuche über alle Nachrichten
- Filter nach Raum, Absender und Datumsbereich
- Ergebnisse mit Avatar, Absender, Raum und Zeit

### 3. Filter-Optionen
- **Raum-Filter**: Beschränkt Suche auf spezifischen Raum
- **Absender-Filter**: Zeigt nur Nachrichten eines bestimmten Benutzers
- **Datums-Filter**: Von/Bis Datumsbereich

### 4. Schnellzugriff
- **API**: `src/app/api/chat/recent/route.ts`
- Letzte Räume (zuletzt besucht)
- Häufige Kontakte (basierend auf Direkt-Chats)

## Verwendung

### UI-Integration

Die ChatSearch-Komponente ist im Root-Layout (`src/app/layout.tsx`) eingebunden:

```tsx
import { ChatSearch } from "@/components/chat";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ChatSearch />
      </body>
    </html>
  );
}
```

### Keyboard-Shortcuts

- `Cmd+K` (Mac) oder `Ctrl+K` (Windows/Linux): Such-Modal öffnen
- `Esc`: Such-Modal schließen
- `↑/↓`: Durch Ergebnisse navigieren
- `Enter`: Element auswählen
- `Tab`: Zwischen Tabs wechseln

### URL-Parameter für Raum-Auswahl

Die Chat-Seite unterstützt URL-Parameter für die direkte Raum-Auswahl:

```
/chat?room=<room-id>
```

Dies wird von der ChatSearch-Komponente verwendet, um nach Auswahl eines Raums direkt dorthin zu navigieren.

## API-Endpunkte

### GET /api/chat/search

Parameter:
- `query` (optional): Suchbegriff
- `roomId` (optional): Filter nach Raum
- `senderId` (optional): Filter nach Absender
- `dateFrom` (optional): Startdatum (ISO)
- `dateTo` (optional): Enddatum (ISO)

Antwort:
```json
{
  "messages": [...],
  "rooms": [...],
  "users": [...],
  "nextCursor": "..."
}
```

### GET /api/chat/recent

Antwort:
```json
{
  "recentRooms": [...],
  "recentContacts": [...]
}
```

## Datenbank-Indizes

Die folgenden Indizes sollten für optimale Performance vorhanden sein:

```sql
-- Für Nachrichtensuche
CREATE INDEX idx_chat_messages_content ON chat_messages USING gin(to_tsvector('german', content));
CREATE INDEX idx_chat_messages_sent_at ON chat_messages(sentAt DESC);
CREATE INDEX idx_chat_messages_room_sender ON chat_messages(roomId, senderId);

-- Für Raumsuche
CREATE INDEX idx_chat_rooms_name ON chat_rooms(name);
CREATE INDEX idx_chat_rooms_updated ON chat_rooms(updatedAt DESC);
```

## Zukünftige Verbesserungen

- [ ] Volltextsuche mit PostgreSQL tsvector
- [ ] Mehrsprachige Suche (Deutsch, Englisch)
- [ ] Suchhistorie speichern
- [ ] Suchvorschläge basierend auf Historie
- [ ] Erweiterte Filter (Dateityp, Nachrichtentyp)
- [ ] Bulk-Export von Suchergebnissen

## Lizenz

Dieser Code ist Teil des HR-Management-Systems.
