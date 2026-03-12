# Dokumenten-Signatur Workflow

## Übersicht

Das Dokumenten-Signatur Workflow-Modul ermöglicht das digitale Unterschreiben von Dokumenten im Chat-System.

## Features

### 1. Dokument aus Chat unterschreiben (`/sign Vertrag.pdf`)
- Chat-Befehl: `/sign <Dateiname.pdf> [@Benutzer]`
- Dokument wird automatisch gefunden und Signatur-Anfrage erstellt
- Empfänger werden per Mention oder automatisch ermittelt

### 2. Workflow: Anfrage → Genehmigung → Signatur
- **PENDING**: Anfrage wurde erstellt und wartet auf Genehmigung
- **APPROVED**: Anfrage wurde genehmigt und wartet auf Signatur
- **SIGNED**: Dokument wurde erfolgreich signiert
- **REJECTED**: Anfrage wurde abgelehnt
- **CANCELLED**: Anfrage wurde storniert

### 3. PDF-Vorschau im Chat
- Direkte Vorschau der PDF-Dateien im Chat
- Möglichkeit die Vorschau zu öffnen/schließen
- Originaldokument kann heruntergeladen werden

### 4. E-Signatur Canvas Komponente
- Touch-fähige Zeichenfläche für Unterschriften
- Unterstützt Maus und Touch-Eingabe
- Speichert Signatur als PNG-Base64

## Datenbank-Schema

### DocumentSignatureRequest
- `id`: Eindeutige ID
- `documentId`: Verknüpfung zum Dokument
- `status`: Aktueller Status der Anfrage
- `title`: Titel der Anfrage
- `message`: Nachricht an Empfänger
- `createdById`: Ersteller der Anfrage
- `roomId`: Optional: Chat-Raum für Rückfragen

### DocumentSignatureParticipant
- `requestId`: Verknüpfung zur Anfrage
- `userId`: Teilnehmer
- `role`: Rolle (REQUESTER, APPROVER, SIGNER)
- `actedAt`: Zeitpunkt der Aktion

### DocumentSignature
- `requestId`: Verknüpfung zur Anfrage
- `signerId`: Unterzeichner
- `signatureData`: Base64-encoded Signatur
- `signedAt`: Zeitpunkt der Unterschrift
- `ipAddress`: IP-Adresse für Audit

## API-Endpunkte

### GET /api/signatures
Liste aller Signatur-Anfragen (gesendet/empfangen)

### POST /api/signatures
Neue Signatur-Anfrage erstellen

### GET /api/signatures/[id]
Einzelne Anfrage abrufen

### PATCH /api/signatures/[id]
Status aktualisieren (APPROVED, REJECTED, CANCELLED)

### POST /api/signatures/[id]/sign
Dokument unterschreiben

### GET /api/documents/preview
PDF-Vorschau laden

## Chat-Befehle

### /sign <Dateiname> [@User]
Erstellt eine Signatur-Anfrage für das angegebene Dokument.

Beispiele:
- `/sign Vertrag.pdf` - Signatur für Dokumentenbesitzer
- `/sign Vertrag.pdf @max` - Signatur für spezifischen User

## Seiten

### /sign/[id]
Dedizierte Seite für das Signieren eines Dokuments.
- Zeigt Dokument-Vorschau
- E-Signatur Canvas
- Status der Anfrage

## Komponenten

### SignatureCanvas
React-Komponente für die Unterschrifteingabe.

```tsx
<SignatureCanvas
  width={600}
  height={200}
  onChange={(signatureData) => console.log(signatureData)}
  penColor="#000000"
  penWidth={2}
/>
```

### PDFPreview
PDF-Ansicht im Chat oder auf der Signatur-Seite.

```tsx
<PDFPreview
  filePath="/uploads/documents/example.pdf"
  fileName="example.pdf"
  height={400}
/>
```

### SignatureModal
Modal für den Signatur-Workflow im Chat.

```tsx
<SignatureModal
  requestId="..."
  isOpen={true}
  onClose={() => {}}
  onSigned={() => {}}
/>
```

## EventBus Events

- `document.signature.requested`: Neue Signatur-Anfrage erstellt
- `document.signature.approved`: Anfrage wurde genehmigt
- `document.signature.signed`: Dokument wurde signiert
- `document.signature.rejected`: Anfrage wurde abgelehnt

## Benachrichtigungen

- `SIGNATURE_REQUESTED`: Neue Signatur-Anfrage
- `SIGNATURE_APPROVED`: Anfrage genehmigt
- `SIGNATURE_SIGNED`: Dokument signiert
- `SIGNATURE_REJECTED`: Anfrage abgelehnt

## Installation

1. Prisma-Migration ausführen:
```bash
npx prisma migrate dev --name add_document_signature
```

2. PDF-Viewer Bibliothek installieren:
```bash
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout pdfjs-dist
```

3. Event-Handler initialisieren (in `src/lib/events/index.ts`):
```typescript
import { initializeDocumentSignatureEventHandlers } from './handlers/documentSignatureEvents';
initializeDocumentSignatureEventHandlers();
```

## Testing

### Signatur-Anfrage über Chat erstellen:
```
/sign Vertrag.pdf @max
```

### Signatur-Seite aufrufen:
```
GET /sign/<request-id>
```

### API-Test:
```bash
curl -X POST http://localhost:3000/api/signatures \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "...",
    "signerIds": ["user-id"],
    "title": "Bitte signieren"
  }'
```

## Sicherheit

- Nur eingeloggte User können signieren
- Nur Empfänger oder Admin können signieren
- IP-Adresse und User-Agent werden protokolliert
- Signatur ist base64-encoded und in Datenbank gespeichert
