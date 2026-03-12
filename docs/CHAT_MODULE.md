# Chat Module

Echtzeit-Chat-System für das HR Management System.

## Features

- **Chat-Räume**: DIRECT, GROUP, DEPARTMENT, SYSTEM
- **Nachrichten**: Text, Antworten, Reaktionen, Anhänge
- **Echtzeit**: Socket.IO für Live-Updates
- **Auto-Willkommenschat**: Bei neuem Mitarbeiter wird automatisch ein Willkommenschat erstellt

## API Endpunkte

### Räume verwalten

```
GET    /api/chat/rooms              # Alle Räume des Users
POST   /api/chat/rooms              # Raum erstellen
GET    /api/chat/rooms/:id          # Raum-Details + Mitglieder
PATCH  /api/chat/rooms/:id          # Raum bearbeiten
DELETE /api/chat/rooms/:id          # Raum löschen
```

### Nachrichten

```
GET    /api/chat/rooms/:id/messages # Nachrichten laden (paginiert)
POST   /api/chat/rooms/:id/messages # Nachricht senden
```

### Einzelne Nachricht

```
PATCH  /api/chat/messages/:id      # Nachricht bearbeiten
DELETE /api/chat/messages/:id      # Nachricht löschen (soft)
POST   /api/chat/messages/:id/reactions # Reaktion hinzufügen
DELETE /api/chat/messages/:id/reactions?emoji=👍 # Reaktion entfernen
```

### Mitglieder

```
GET    /api/chat/rooms/:id/members  # Mitglieder auflisten
POST   /api/chat/rooms/:id/members  # Mitglied hinzufügen
```

### WebSocket

```
Socket.IO path: /api/socket

Events:
- authenticate (userId)        # Auth beim Verbinden
- join-room (roomId)           # Raum beitreten
- leave-room (roomId)          # Raum verlassen
- typing { roomId, isTyping }  # "Tippt..." Status

Listener:
- new-message                  # Neue Nachricht
- user-typing                  # Jemand tippt
- joined-room                  # Beigetreten
```

## Database Schema

### ChatRoom
- id, name, type (DIRECT/GROUP/DEPARTMENT/SYSTEM)
- isSystem, description, avatarUrl
- relatedEntityType/Id (für System-Räume)

### ChatMember
- roomId, userId, role (MEMBER/ADMIN/OWNER)
- joinedAt, lastReadAt, isMuted

### ChatMessage
- roomId, senderId, content
- sentAt, editedAt, isDeleted, isSystem
- replyToId (für Thread-Antworten)

### ChatReaction
- messageId, userId, emoji

### ChatAttachment
- messageId, filePath, fileName, fileSize, mimeType

## EventBus Integration

### Ausgehende Events

```typescript
// Wenn Mitarbeiter erstellt wird
hr.employee.created -> {
  employeeId: string
  firstName: string
  lastName: string
  email: string
}

// Chat Events
chat.room.created -> { roomId, type, memberIds }
chat.welcome.sent -> { roomId, employeeId, employeeUserId }
```

### Eingehende Events

```typescript
// Automatische Handler
hr.employee.created -> Erstellt Willkommenschat
```

## React Hook

```typescript
import { useSocket } from '@/hooks/useSocket';

function ChatComponent() {
  const { 
    socket, 
    isConnected, 
    isAuthenticated,
    joinRoom, 
    sendTyping, 
    onMessage 
  } = useSocket();

  useEffect(() => {
    if (isAuthenticated) {
      joinRoom('room-id');
      
      const unsubscribe = onMessage((msg) => {
        console.log('New message:', msg);
      });
      
      return unsubscribe;
    }
  }, [isAuthenticated, joinRoom, onMessage]);

  return <div>Status: {isConnected ? 'Online' : 'Offline'}</div>;
}
```

## Roadmap

- [x] Prisma Schema
- [x] API Routes
- [x] EventBus Integration
- [x] WebSocket (Socket.IO)
- [ ] Datei-Uploads
- [ ] Push Notifications
- [ ] Mobile-Optimierung
- [ ] Nachrichten-Suche