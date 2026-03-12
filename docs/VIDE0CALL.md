# Videoanruf-Feature

## Überblick
WebRTC-basierte Videoanruf-Integration im Chat-Modul mit Unterstützung für 1-zu-1 und Gruppenanrufe (max. 5 Teilnehmer).

## Features
- **1-zu-1 Videoanruf**: Direkte Videoanrufe zwischen zwei Teilnehmern
- **Gruppenvideo**: Bis zu 5 Teilnehmer in einem Anruf
- **Bildschirmfreigabe**: Möglichkeit den Bildschirm zu teilen
- **/call Kommando**: Textbefehl `/call` zum Starten eines Anrufs
- **Audio/Video Steuerung**: Mute, Video an/aus, Bildschirmfreigabe

## Technologie
- **WebRTC**: Native browser WebRTC APIs
- **simple-peer**: Simplifizierte Peer-to-Peer Verbindungen
- **Socket.IO**: Signaling-Server für Verbindungsaufbau

## Dateien
```
src/
  components/video-call/
    VideoCallModal.tsx    # Hauptvideoanruf-Dialog
    VideoGrid.tsx         # Videogitter für alle Teilnehmer
    CallControls.tsx      # Anruf-Steuerungen (Mute, Video, etc.)
    CallOverlay.tsx       # Eingehende Anruf-Anzeige
  hooks/
    useWebRTC.ts          # WebRTC Logik und State-Management
  types/
    videoCall.ts          # TypeScript Interfaces

## Nutzung
1. Im Chat auf das Videokamera-Icon in der Header-Leiste klicken
2. Oder `/call` in die Nachrichteneingabe tippen und absenden
3. Beim Empfänger erscheint ein Anruf-Dialog zum Annehmen/Ablehnen

## API-Endpunkte (Socket.IO)
- `call-started`     # Anruf gestartet
- `call-accepted`    # Anruf angenommen
- `signaling`        # WebRTC Signalisierung (offer/answer/ice)
- `call-ended`       # Anruf beendet
- `call-declined`    # Anruf abgelehnt

## Limitierungen
- Maximal 5 Teilnehmer in Gruppenanrufen
- Browser müssen Kamera/Mikrofon-Zugriff erlauben
- STUN/TURN-Server für NAT-Traversal nicht konfiguriert (lokale Entwicklung)
