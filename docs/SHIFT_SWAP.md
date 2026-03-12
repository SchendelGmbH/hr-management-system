# Schicht-Tausch Modul

## Überblick

Das Schicht-Tausch Modul ermöglicht es Mitarbeitern, ihre zugewiesenen Schichten mit Kollegen zu tauschen. Das System bietet eine vollständige Workflow-Verwaltung von der Anfrage bis zur Genehmigung und automatischen Planänderung.

## Features

### 1. Datenbank-Schema

#### Modelle
- **ShiftSwap**: Hauptanfrage für einen Schichtwechsel
- **SwapResponse**: Antworten auf Anfragen mit alternativen Schichten
- Erweiterte Relations in `Employee`, `User`, `DailyPlanAssignment`

#### Status
- `PENDING`: Ausstehend
- `APPROVED`: Genehmigt (noch nicht ausgeführt)
- `REJECTED`: Abgelehnt
- `CANCELLED`: Storniert
- `COMPLETED`: Abgeschlossen (Schichten wurden getauscht)

### 2. API-Endpunkte

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/swaps/search` | GET | Sucht verfügbare Tauschpartner für ein Datum |
| `/api/swaps/request` | POST | Erstellt eine neue Tauschanfrage |
| `/api/swaps/request` | GET | Listet alle Anfragen eines Mitarbeiters |
| `/api/swaps/approve` | POST | Genehmigt/ablehnt/storniert eine Anfrage |
| `/api/swaps/approve` | PUT | Erstellt eine Antwort auf eine Anfrage |
| `/api/calendar/shifts` | GET | Lädt Schicht-Events für den Kalender |

### 3. EventBus & Realtime

#### Events
- `SHIFT_SWAP_CREATED`: Neue Anfrage erstellt
- `SHIFT_SWAP_UPDATED`: Anfrage aktualisiert
- `SHIFT_SWAP_RESPONSE_CREATED`: Antwort erstellt
- `SHIFT_SWAP_COMPLETED`: Tausch abgeschlossen
- `SCHEDULE_CHANGED`: Plan wurde geändert

#### Socket.IO Integration
- Automatische Subscription für Mitarbeiter
- Realtime-Benachrichtigungen bei Status-Änderungen
- Instant-Reload der UI bei Events

### 4. Benachrichtigungen

- **Neue Anfrage**: Empfänger wird benachrichtigt
- **Antwort erhalten**: Anfragender wird benachrichtigt
- **Genehmigung**: Status-Änderung mit Benachrichtigung
- **Abgeschlossen**: Beide Parteien werden informiert

### 5. UI-Komponenten

#### SwapButton
- Icon-Button in Kalender-Einträgen
- Zeigt aktiven Tausch-Status (orange)
- Öffnet SwapModal bei Klick

#### SwapModal
- Zeigt eigene Schicht
- Liste verfügbarer Tauschpartner
- Notiz-Feld für persönliche Nachricht
- Submit mit Validierung

#### ShiftCalendarView
- Voller Kalender mit Schicht-Anzeige
- Eigene Schichten (grün)
- Ausstehende Tausche (orange)
- Tausch-Icon-Integration

#### SwapRequestsOverview
- Tab-basierte Ansicht (Alle/Gesendet/Empfangen)
- Status-Filter
- Detail-Ansicht mit Genehmigungs-Buttons
- Responsive Design

### 6. Seiten

#### /my-schedule
- Persönlicher Schichtplan
- Kalender-Ansicht mit Swap-Funktion
- Link zu Tausch-Anfragen

#### /swaps
- Übersicht aller Tauschanfragen
- Verwaltung gesendeter/empfangener Anfragen
- Genehmigungs-Workflow

## Workflow

### 1. Anfrage senden
```
Mitarbeiter A > Klickt auf Swap-Button > Wählt Partner B > Sendet Anfrage
> System erstellt Notification für B
> EventBus informiert alle Clients
```

### 2. Genehmigung
```
Mitarbeiter B > Empfängt Notification > Öffnet /swaps > Sieht Anfrage
> Klickt Genehmigen > System führt Tausch durch
> Beide erhalten Completion-Notification
> Pläne werden automatisch aktualisiert
```

### 3. Automatischer Tausch
```
Bei Genehmigung:
1. Assignment A wird umkonfiguriert (neuer siteId)
2. Assignment B wird umkonfiguriert (neuer siteId)
3. Notizen werden hinzugefügt ("Getauscht mit...")
4. Audit-Log-Eintrag wird erstellt
5. EventBus emitte SCHEDULE_CHANGED
```

## Technische Details

### Hooks

#### useShiftSwaps
- CRUD-Operationen
- Socket.IO-Integration
- Auto-refresh bei Events

#### useSocketSwap
- Socket.IO-Verbindung
- Room-Subscription für Employee
- Callback-Handler für Events

### Datenbank-Schema-Updates

```prisma
// Neue Modelle
model ShiftSwap { ... }
model SwapResponse { ... }

// Neue Enum-Werte
enum NotificationType {
  // ... bestehende
  SHIFT_SWAP
  SHIFT_SWAP_RESPONSE
  SHIFT_SWAP_APPROVED
  SHIFT_SWAP_COMPLETED
}
```

### Navigation

- `Mein Plan` (mySchedule) > Persönlicher Kalender
- `Schicht-Tausch` (swaps) > Anfragen-Verwaltung

## Test-Checkliste

- [ ] Datenbank-Migration durchlaufen
- [ ] Kalender zeigt Schichten an
- [ ] Swap-Button sichtbar in eigener Schicht
- [ ] Modal öffnet sich bei Klick
- [ ] Tauschpartner werden geladen
- [ ] Anfrage wird erstellt
- [ ] Empfänger sieht Notification
- [ ] Genehmigung aktualisiert Plan
- [ ] Beide Seiten sehen neue Schichten
- [ ] Audit-Log-Eintrag vorhanden

## Zukünftige Erweiterungen

1. **Zeitfenster**: Konfigurierbare Deadline für Anfragen
2. **Manager-Genehmigung**: Pflicht für bestimmte Abteilungen
3. **Skill-Matching**: Automatische Empfehlungen basierend auf Qualifikationen
4. **Vertretungs-Kaskade**: Automatische Weitergabe bei Ablehnung
5. **Statistik**: Tausch-Historie, beliebteste Partner, etc.

---

**Letzte Aktualisierung:** 2024-03-12
**Version:** 1.0.0
**Branch:** feature/overnight-chat-module
