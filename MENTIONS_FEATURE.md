# Chat Mentions Feature

## Übersicht
Das Chat-Mention-Feature ermöglicht es Benutzern, andere Personen mit @Name im Chat zu erwähnen. Das System bietet:

1. **@Erwähnungen mit Dropdown**: Beim Eingeben von @ erscheint eine Liste der verfügbaren Benutzer
2. **Hervorhebung**: Erwähnungen werden in Nachrichten visuell hervorgehoben
3. **Benachrichtigungen**: Erwähnte Benutzer erhalten Benachrichtigungen
4. **Erwähnungs-History**: Ein Verlauf aller Erwähnungen ist verfügbar

## Komponenten

### MentionsDropdown.tsx
- Zeigt verfügbare Benutzer beim Tippen von @ an
- Unterstützt Tastaturnavigation (Pfeile, Enter, Escape)
- Filtert Benutzer basierend auf der Eingabe

### MessageContent.tsx
- Rendert Nachrichten mit @Erwähnungen
- Heißt erwähnte Benutzer visuell hervor
- Unterstützt eigenes Styling für aktuellen Benutzer

### MentionNotifications.tsx
- Dropdown mit ungelesenen Erwähnungen
- Zeigt Erwähnungs-History an
- Erlaubt Markierung als gelesen oder Löschen

## API-Endpunkte

### POST /api/chat/rooms/[id]/messages
- Extrahiert @Erwähnungen aus dem Nachrichteninhalt
- Erstellt ChatMention-Datensätze in der Datenbank
- Sendet Benachrichtigungen an erwähnte Benutzer

### GET /api/chat/mentions
- Gibt alle Erwähnungen des aktuellen Benutzers zurück
- Unterstützt Paginierung
- Zeigt an, ob Erwähnungen gelesen wurden

### PATCH /api/chat/mentions
- Markiert Erwähnungen als gelesen
- Unterstützt selektive oder massenweise Aktualisierung

### DELETE /api/chat/mentions
- Löscht bestimmte Erwähnungen (Archivierung)

## Datenbank

### ChatMention-Modell
```prisma
model ChatMention {
  id              String    @id @default(cuid())
  messageId       String
  senderId        String    // Wer erwähnt hat
  mentionedUserId String    // Wer erwähnt wurde
  mentionedAt     DateTime  @default(now())
  isRead          Boolean   @default(false)
  readAt          DateTime?
}
```

## Verwendung

### Eine @Erwähnung erstellen:
1. Tippe @ im Chat-Eingabefeld
2. Wähle einen Benutzer aus dem Dropdown aus
3. Sende die Nachricht

### Erwähnungen anzeigen:
- Klicke auf das Glocken-Symbol in der Chat-Header-Leiste
- Alle ungelesenen Erwähnungen werden angezeigt
- Klicke auf eine Erwähnung, um zum Chat zu springen

## Technische Details

### Mention-Erkennung
Mentions werden im Format `@Name (userId)` gespeichert, um:
- Korrekte Zuordnung zu Benutzern zu ermöglichen (auch bei Namensänderungen)
- Saubere Extraktion bei der Backend-Verarbeitung
- Eindeutige Identifikation zu gewährleisten

### Real-time Updates
- Socket.IO wird für sofortige Benachrichtigungen verwendet
- Benutzer erhalten Echtzeit-Updates über neue Erwähnungen

## Commits
1. `feat(chat): add mentions dropdown and highlighting`
2. `feat(chat): add mention notifications UI and API`
3. `feat(chat): add database migration for ChatMention table`

## Zukunftige Erweiterungen
- Erwähnungen in Nachrichten suchen
- Erwähnungen in E-Mails optional senden
- Push-Benachrichtigungen für mobile Geräte
