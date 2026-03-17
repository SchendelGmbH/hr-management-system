# 🔧 Chat Fix für HR Management System

**Datum:** 15.03.2026  
**Problem:** Chat-Nachrichten werden nicht gesendet, WebSocket bricht ab, 403 Fehler

---

## 🚨 Probleme identifiziert

### 1. Socket.IO Port-Mismatch
- **Server läuft auf:** Port 3002 (separater HTTP-Server)
- **Client verbindet zu:** Port 3001 (`window.location.origin`)
- **Ergebnis:** WebSocket kann sich nicht verbinden

### 2. CORS-Konfiguration
- **Server erlaubt:** `process.env.NEXTAUTH_URL` oder `localhost:3000`
- **App läuft auf:** `srv1471808.tail4c3c89.ts.net:3001`
- **Ergebnis:** Verbindung wird abgelehnt

### 3. Auth/Middleware (403 statt 401)
- Notifications API gibt 401 zurück, aber Browser zeigt 403
- Mögliche Ursache: Zusätzliche Middleware blockiert Requests

---

## ✅ Lösungen

### Fix 1: Environment Variable setzen

Erstelle/aktualisiere `.env.local`:

```bash
# Socket.IO Server URL (wichtig!)
NEXT_PUBLIC_SOCKET_URL=http://srv1471808.tail4c3c89.ts.net:3002

# Oder wenn du einen Reverse Proxy hast:
# NEXT_PUBLIC_SOCKET_URL=/socket.io

# CORS erlaubte Origins (für Socket.IO Server)
NEXTAUTH_URL=http://srv1471808.tail4c3c89.ts.net:3001
```

**Wichtig:** Nach `.env.local` Änderung muss der Server neu gestartet werden!

---

### Fix 2: Socket.IO Server CORS anpassen

**Datei:** `src/app/api/socket/route.ts`

Ändere die CORS-Konfiguration (Zeile ~95):

```typescript
// ALT (zu restriktiv):
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// NEU (flexibler):
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'http://srv1471808.tail4c3c89.ts.net:3001',
      // Füge hier weitere Origins hinzu wenn nötig
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  // Wichtig: Ping-Timeout erhöhen für stabile Verbindung
  pingTimeout: 60000,
  pingInterval: 25000,
});
```

---

### Fix 3: Socket.IO in Next.js integrieren (Empfohlen)

Anstatt einen separaten Port (3002) zu verwenden, integriere Socket.IO direkt in Next.js:

**Datei:** `src/app/api/socket/route.ts` - Ersetze den gesamten Inhalt:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';

// Globaler Socket.IO Server
declare global {
  var io: SocketIOServer | undefined;
}

export function getSocketIO(): SocketIOServer | null {
  return global.io || null;
}

export function emitToRoom(roomId: string, event: string, data: unknown) {
  const io = getSocketIO();
  if (io) {
    io.to(`room:${roomId}`).emit(event, data);
  }
}

// Socket.IO mit Next.js integrieren
export async function GET(req: NextRequest) {
  if (global.io) {
    return NextResponse.json({ status: 'already-running' });
  }

  // @ts-ignore - Next.js interne API
  const res = await fetch('http://localhost:3000');
  // @ts-ignore
  const server = res.socket?.server;
  
  if (!server) {
    return NextResponse.json({ error: 'Server not available' }, { status: 500 });
  }

  const io = new SocketIOServer(server, {
    path: '/api/socket',
    cors: {
      origin: '*', // In Production spezifisch setzen!
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  global.io = io;

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    socket.on('authenticate', (userId: string) => {
      socket.data.userId = userId;
      socket.join(`user:${userId}`);
      socket.emit('authenticated', { success: true });
    });

    socket.on('join-room', async (roomId: string) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const membership = await prisma.chatMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member' });
        return;
      }

      socket.join(`room:${roomId}`);
      socket.emit('joined-room', { roomId });
    });

    socket.on('typing', ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
      const userId = socket.data.userId;
      if (!userId) return;
      socket.to(`room:${roomId}`).emit('user-typing', { roomId, userId, isTyping });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });

  return NextResponse.json({ status: 'initialized' });
}

export async function POST() {
  return GET();
}
```

**Dann in `useSocket.ts` anpassen:**

```typescript
// Entferne den separaten Socket-Port
const socket = io('/api/socket', {  // Statt socketUrl
  transports: ['websocket', 'polling'],
  autoConnect: true,
  // ... restliche Config
});
```

---

### Fix 4: Notifications 403 Debug

Die 403 Fehler auf `/api/notifications` deuten auf eine Middleware hin. Prüfe:

**Datei:** `src/middleware.ts` oder `src/app/middleware.ts`

Suche nach:
- `matcher` Config die `/api/notifications` blockiert
- CSRF-Protection die Requests blockiert
- IP-Whitelist/Blacklist

**Quick Fix** - Füge zur Middleware hinzu:

```typescript
export const config = {
  matcher: [
    // Exkludiere API-Routes die Auth selbst handhaben
    '/((?!api/notifications|api/socket|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

## 🧪 Test-Plan

Nach den Fixes:

1. **Server neu starten:**
   ```bash
   npm run dev
   # oder
   yarn dev
   ```

2. **Browser Console checken:**
   - Keine "WebSocket closed before established" mehr
   - Keine 403 Fehler auf Notifications
   - "[Socket] Connected" und "[Socket] Authenticated" sollten erscheinen

3. **Chat testen:**
   - Nachricht senden
   - Prüfen ob sie im anderen Browser/Tab ankommt

---

## 📝 Notizen

- **Port 3002** ist der separate Socket.IO Server (aktuell)
- **Port 3001** ist die Next.js App
- Der Client muss zum richtigen Port verbinden!
- Empfohlene Lösung: Socket.IO in Next.js integrieren (kein separater Port)
