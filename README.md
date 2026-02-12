# HR Management System

Ein vollständiges HR Management System für die Verwaltung von Mitarbeitern, Dokumenten, Arbeitskleidung, Urlaub und Benachrichtigungen.

## 🚀 Features

- ✅ **Mitarbeiter-Verwaltung**: Stammdaten, Custom Fields, Größen für Arbeitskleidung
- ✅ **Dokumentenmanagement**: Upload, Ablaufverfolgung, automatische Benachrichtigungen
- ✅ **Arbeitskleidung**: Budget-Tracking, Bestellverwaltung, Artikelkatalog
- ✅ **Kalender**: Urlaube, Dokument-Fristen, Überschneidungserkennung
- ✅ **Benachrichtigungen**: Email + Dashboard-Benachrichtigungen
- ✅ **Mehrsprachig**: Deutsch (Standard) + Englisch
- ✅ **Sicherheit**: Authentifizierung, Audit-Logging, Verschlüsselung

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js
- **Datenbank**: PostgreSQL + Prisma ORM
- **i18n**: next-intl
- **Formulare**: React Hook Form + Zod
- **Kalender**: FullCalendar
- **Email**: Nodemailer

## 📋 Voraussetzungen

- Node.js 20+ und npm
- PostgreSQL 14+ (lokal oder Cloud)

## 🔧 Installation

### 1. Repository klonen und Dependencies installieren

\`\`\`bash
cd hr-management-system
npm install
\`\`\`

### 2. Datenbank einrichten

**PostgreSQL installieren** (falls nicht vorhanden):
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql`
- Linux: `sudo apt install postgresql`

**Datenbank erstellen**:
\`\`\`sql
CREATE DATABASE hr_management;
\`\`\`

### 3. Environment Variables konfigurieren

Kopiere `.env.example` zu `.env`:
\`\`\`bash
cp .env.example .env
\`\`\`

Bearbeite `.env` und füge deine Datenbank-Credentials ein:
\`\`\`env
DATABASE_URL="postgresql://username:password@localhost:5432/hr_management?schema=public"
NEXTAUTH_SECRET="dein-geheimer-schlüssel-hier"
NEXTAUTH_URL="http://localhost:3000"

# Optional: SMTP für Email-Benachrichtigungen
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASSWORD="password"
SMTP_FROM="noreply@hr-system.com"
\`\`\`

**NEXTAUTH_SECRET generieren**:
\`\`\`bash
openssl rand -base64 32
\`\`\`

### 4. Datenbank migrieren und mit Test-Daten füllen

\`\`\`bash
npm run db:migrate
npm run db:seed
\`\`\`

### 5. Entwicklungsserver starten

\`\`\`bash
npm run dev
\`\`\`

Öffne [http://localhost:3000](http://localhost:3000) im Browser.

## 🔑 Login-Daten

Nach dem Seeding sind folgende Test-Credentials verfügbar:

- **Username**: `admin`
- **Password**: `Admin123!`
- **Email**: `admin@hr-system.local`

## 📦 NPM Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm run dev` | Entwicklungsserver starten |
| `npm run build` | Production Build erstellen |
| `npm start` | Production Server starten |
| `npm run lint` | Code-Linting |
| `npm run db:migrate` | Datenbank-Migrationen ausführen |
| `npm run db:seed` | Test-Daten in DB einfügen |
| `npm run db:studio` | Prisma Studio öffnen (DB GUI) |
| `npm run db:reset` | Datenbank zurücksetzen (⚠️ löscht alle Daten!) |

## 🗂️ Projektstruktur

\`\`\`
hr-management-system/
├── prisma/
│   ├── schema.prisma         # Datenbank-Schema
│   ├── seed.ts               # Seed-Daten
│   └── migrations/           # DB-Migrationen
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── [locale]/         # i18n Routes
│   │   ├── api/              # API Routes
│   │   └── login/            # Login-Seite
│   ├── components/           # React Components
│   ├── lib/                  # Utilities
│   ├── hooks/                # Custom Hooks
│   ├── types/                # TypeScript Types
│   ├── validators/           # Zod Schemas
│   └── messages/             # i18n Übersetzungen
├── public/
│   └── uploads/              # Hochgeladene Dateien
└── .env                      # Environment Variables
\`\`\`

## 📝 Nächste Schritte

Nach der Installation:

1. **Login testen**: Melde dich mit den Admin-Credentials an
2. **Mitarbeiter anlegen**: Erstelle weitere Test-Mitarbeiter
3. **Dokumente hochladen**: Teste den Dokument-Upload
4. **Arbeitskleidung bestellen**: Erstelle Test-Bestellungen
5. **Kalender erkunden**: Füge Urlaube hinzu
6. **Benachrichtigungen**: Prüfe Dashboard-Benachrichtigungen

## 🚢 Deployment

### Vercel (empfohlen)

1. Vercel Account erstellen: https://vercel.com
2. Projekt importieren
3. Environment Variables hinzufügen
4. Database: Vercel Postgres oder externe PostgreSQL DB
5. Deploy!

### Docker

\`\`\`bash
# Docker-Support folgt in Phase 2
\`\`\`

### Traditioneller Server

\`\`\`bash
npm run build
npm start
# Mit PM2 oder systemd als Service einrichten
\`\`\`

## 🔒 Sicherheit

- Passwörter werden mit bcrypt gehasht (10 Rounds)
- HTTPS in Produktion verwenden
- Environment Variables nie committen
- Session-Timeout: 30 Minuten
- Audit-Logging für alle Änderungen

## 📧 SMTP Konfiguration

Für Email-Benachrichtigungen SMTP-Server konfigurieren:

**Gmail**:
\`\`\`env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="app-specific-password"
\`\`\`

**Outlook/Office365**:
\`\`\`env
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
\`\`\`

## 🐛 Troubleshooting

### Datenbank-Verbindung fehlgeschlagen
- PostgreSQL läuft?
- DATABASE_URL korrekt in .env?
- Firewall-Einstellungen prüfen

### Prisma Generate Fehler
\`\`\`bash
npx prisma generate
\`\`\`

### Port 3000 bereits belegt
\`\`\`bash
npm run dev -- -p 3001
\`\`\`

## 📄 Lizenz

Proprietary - Alle Rechte vorbehalten

## 🤝 Support

Bei Fragen oder Problemen:
- Issue erstellen im Repository
- Dokumentation prüfen
- Logs prüfen: `.next/`, Konsole

---

Entwickelt mit ❤️ und Next.js
