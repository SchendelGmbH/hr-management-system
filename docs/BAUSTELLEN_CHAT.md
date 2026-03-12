# BAUE Baustellen-Chat Modul

## Übersicht

Automatische Chat-Räume für Baustellen mit Material-Anfragen, Check-in/out und Einsatzplanung-Integration.

## Features

### 1. Auto-Chatroom bei Baustellen-Anlage 🏗️

Wenn eine Baustelle über die Einsatzplanung angelegt wird:
- Automatischer Chat-Raum wird erstellt (Typ: `WORKSITE`)
- Willkommensnachricht mit verfügbaren Befehlen
- Verknüpfung zur WorkSite via `relatedEntityId`

**Event:** `baustelle.created`

### 2. Automatischer Mitarbeiter-Invite bei Einsatzplanung 👥

Wenn Mitarbeiter einer Baustelle zugewiesen werden:
- Mitarbeiter wird automatisch zum Chat hinzugefügt
- System-Nachricht über Join
- Nur einmal pro Mitarbeiter (Duplikate verhindert)

**Event:** `baustelle.assigned`

### 3. Chat-Befehle 💬

| Befehl | Beschreibung | Beispiel |
|--------|--------------|----------|
| `/material <Menge> <Name>` | Material anfragen | `/material 50 Ziegel` |
| `/checkin` | Baustellen-Check-in | `/checkin` |
| `/checkout` | Baustellen-Check-out | `/checkout` |
| `/status` | Zeigt eingecheckte Mitarbeiter | `/status` |

### 4. Material-Anfragen 📦

- Einfaches Format: `/material 50 Ziegel`
- Validierung: Menge muss positive Zahl sein
- Bestätigungsnachricht mit "Warte auf Bestätigung"
- Event wird emittiert für externe Handlers

**Event:** `baustelle.material.requested`

### 5. Check-in/Check-out ⏱️

- `/checkin` - Erfasst Zeitpunkt, sendet Bestätigung
- `/checkout` - Erfasst Zeitpunkt, berechnet Arbeitszeit
- `/status` - Zeigt alle aktuell eingecheckten Mitarbeiter
- Verhindert doppelte Check-ins

**Events:**
- `baustelle.checkin`
- `baustelle.checkout`

## Datenbank-Schema

### ChatRoomType (Enum)
```prisma
enum ChatRoomType {
  DIRECT
  GROUP
  DEPARTMENT
  SYSTEM
  WORKSITE    // NEU: Baustellen-Chat
}
```

### WorkSiteCheckIn (Model)
```prisma
model WorkSiteCheckIn {
  id            String    @id @default(cuid())
  userId        String
  workSiteId    String?   // Optional für globale Check-ins
  date          DateTime  @default(now()) @db.Date
  checkedInAt   DateTime  @default(now())
  checkedOutAt  DateTime?
  latitude      Float?    // GPS (optional)
  longitude     Float?
}
```

## EventBus Events

### Ausgehende Events (Emittiert)

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `baustelle.created` | `{ workSiteId, name, location, createdBy }` | Neue Baustelle angelegt |
| `baustelle.assigned` | `{ workSiteId, employeeId, employeeName, planDate }` | Mitarbeiter zugewiesen |
| `baustelle.material.requested` | `{ roomId, senderId, amount, material, requestedAt }` | Material angefragt |
| `baustelle.checkin` | `{ checkInId, userId, userName, workSiteId, timestamp }` | Check-in erfolgt |
| `baustelle.checkout` | `{ checkInId, userId, userName, durationMinutes }` | Check-out erfolgt |

### Eingehende Events (Abonniert)

| Event | Handler |
|-------|---------|
| `baustelle.created` | `createWorkSiteChatRoom()` |
| `baustelle.assigned` | `addEmployeeToWorkSiteChat()` |
| `chat.message.received` | `handleChatCommand()` |

## API-Integration

### Daily Plans API (`/api/daily-plans/[date]`)

**PUT** - Erstellt/Aktualisiert Einsatzplanung
- Prüft WorkSite Existenz
- Erstellt neue WorkSite → `baustelle.created`
- Erstellt Assignments → `baustelle.assigned`

### Chat Messages API (`/api/chat/rooms/[id]/messages`)

**POST** - Sendet Nachricht
- Speichert Nachricht
- Emittiert `chat.message.received` für Befehls-Verarbeitung

## Dateien

### Neue Dateien
- `src/lib/events/handlers/workSiteEvents.ts` - Haupt-Handler

### Modifizierte Dateien
- `prisma/schema.prisma` - WORKSITE Enum + WorkSiteCheckIn Model
- `src/lib/events/index.ts` - WorkSite Handler Initialisierung
- `src/app/api/daily-plans/[date]/route.ts` - Event-Emission
- `src/app/api/chat/rooms/[id]/messages/route.ts` - Event-Emission

## Test-Szenarien

1. **Baustelle erstellen**
   - Einsatzplanung öffnen
   - Neue Baustelle anlegen
   → Chat-Raum wird automatisch erstellt

2. **Mitarbeiter zuweisen**
   - Mitarbeiter zur Baustelle hinzufügen
   → Mitarbeiter wird zum Chat hinzugefügt
   → Join-Nachricht erscheint

3. **Material anfragen**
   - Im Baustellen-Chat: `/material 100 Ziegel`
   → Bestätigungsnachricht
   → Event wird emittiert

4. **Check-in/out**
   - `/checkin` → Zeit erfasst
   - `/status` → Zeigt eingecheckte
   - `/checkout` → Zeit + Arbeitszeit

## Nächste Schritte

- [ ] Migration erstellen: `npx prisma migrate dev --name add_worksite_checkin`
- [ ] Material-Anfragen per E-Mail an Bestandsmanagement
- [ ] GPS-Koordinaten für Check-in hinzufügen
- [ ] Push-Notifications für Check-in/Check-out
