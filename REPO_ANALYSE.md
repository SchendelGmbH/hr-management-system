# HR-Management-System Repository Analyse

**Repository:** https://github.com/SchendelGmbH/hr-management-system  
**Task:** t_4fc137f6 – Explore and document HR-Management-System repo  
**Datum:** 2026-06-08

---

## 1. Tech Stack

| Bereich | Technologie |
|---------|-------------|
| **Framework** | Next.js 15 (App Router) |
| **Sprache** | TypeScript |
| **UI** | React 19, Tailwind CSS |
| **Backend** | Next.js API Routes, NextAuth.js v5 (Beta) |
| **Datenbank** | PostgreSQL + Prisma ORM 6.2 |
| **Auth** | NextAuth.js mit Prisma Adapter |
| **Formulare** | React Hook Form + Zod Validation |
| **Kalender** | FullCalendar (DayGrid, TimeGrid, Interaction) |
| **Rich Text** | Tiptap Editor |
| **PDF Generierung** | @react-pdf/renderer, pdf-lib, pdf-parse |
| **i18n** | next-intl |
| **E-Mail** | Nodemailer |
| **E-Commerce Integration** | WooCommerce API (axios) |
| **Verschlüsselung** | prisma-field-encryption |
| **Sonstiges** | Puppeteer, mammoth (DOCX), bcryptjs, date-fns |

---

## 2. Projekt-Struktur

```
hr-management-system/
├── prisma/
│   ├── schema.prisma          # Datenbank-Schema (650 Zeilen)
│   ├── seed.ts                # Testdaten
│   └── *.ts                   # Diverse DB-Scripts
├── src/
│   ├── app/
│   │   ├── [locale]/          # i18n Routing (de, en)
│   │   │   ├── employees/      # Mitarbeiter CRUD
│   │   │   ├── documents/      # Dokumentenverwaltung
│   │   │   ├── clothing/       # Arbeitskleidung + WooCommerce
│   │   │   ├── calendar/       # Kalender/Urlaub
│   │   │   ├── planning/       # Tagesplanung
│   │   │   ├── qualifications/ # Qualifikationen
│   │   │   ├── notifications/  # Benachrichtigungen
│   │   │   └── settings/       # Admin-Bereich
│   │   ├── api/               # API Routes
│   │   └── login/
│   ├── components/
│   │   ├── calendar/          # Kalender-Komponenten
│   │   ├── clothing/          # Kleidung-Bestellungen
│   │   ├── dashboard/         # Dashboard-Widgets
│   │   ├── departments/       # Abteilungsverwaltung
│   │   ├── documents/         # Dokumenten-Komponenten
│   │   ├── employees/         # Mitarbeiter-Komponenten
│   │   ├── layout/            # Layout-Komponenten
│   │   ├── notifications/     # Notification-Komponenten
│   │   ├── templates/         # Dokumentvorlagen
│   │   └── ui/                # Generische UI-Komponenten
│   ├── lib/                   # Utilities & Logik
│   │   ├── auth.ts            # NextAuth Konfiguration
│   │   ├── prisma.ts          # Prisma Client
│   │   ├── woocommerce.ts     # WooCommerce API Client
│   │   ├── budget.ts          # Budget-Tracking
│   │   ├── holidays.ts        # Feiertage
│   │   ├── rbac.ts            # Rollen & Rechte
│   │   └── ...
│   ├── messages/              # i18n Übersetzungen (de.json, en.json)
│   ├── i18n/                  # next-intl Konfiguration
│   ├── hooks/                 # Custom React Hooks
│   ├── types/                 # TypeScript Typen
│   └── middleware.ts          # Next.js Middleware
├── docs/                      # Dokumentation (WOOCOMMERCE_SETUP.md)
├── scripts/                   # Hilfs-Scripts (Seed, Create Users, etc.)
├── docker-compose.yml        # Docker Setup
├── Dockerfile
└── package.json
```

**Wichtige Dateien:**
- `README.md` – Installation & Überblick
- `ANLEITUNG.md` – Deutsche Startanleitung
- `QUICK_START.txt` – Kurzanleitung
- `prisma/schema.prisma` – Komplettes DB-Schema

---

## 3. Was macht das System?

Ein **vollständiges HR-Management-System** für die Verwaltung von:

### Kernmodule
- **Mitarbeiter-Verwaltung**: Stammdaten, Custom Fields, Größen für Arbeitskleidung
- **Dokumentenmanagement**: Upload, Ablaufverfolgung, automatische Benachrichtigungen
- **Arbeitskleidung**: Budget-Tracking, Bestellverwaltung, WooCommerce-Integration für Artikelkatalog
- **Kalender**: Urlaube, Krankheit, Sonderurlaub mit Überschneidungserkennung
- **Tagesplanung**: Daily Planner für Mitarbeiter
- **Qualifikationen**: Verwaltung von Mitarbeiter-Qualifikationen
- **Benachrichtigungen**: Email + Dashboard-Benachrichtigungen

### Features
- ✅ Mehrsprachig (Deutsch + Englisch)
- ✅ Rollenbasierte Zugriffskontrolle (RBAC)
- ✅ Audit-Logging aller Änderungen
- ✅ Feldverschlüsselung für sensible Daten (Sozialvers.-Nr., Steuer-ID, etc.)
- ✅ Dokumentvorlagen mit PDF-Generierung
- ✅ WooCommerce-Import für Arbeitskleidung
- ✅ Email-Benachrichtigungen bei Dokument-Ablauf

---

## 4. Dokumentation

| Dokument | Vorhanden | Beschreibung |
|----------|-----------|--------------|
| `README.md` | ✅ Ja | Installation, Tech Stack, Deployment, Troubleshooting |
| `ANLEITUNG.md` | ✅ Ja | Deutsche Schritt-für-Schritt Anleitung |
| `QUICK_START.txt` | ✅ Ja | Kurzanleitung |
| `docs/WOOCOMMERCE_SETUP.md` | ✅ Ja | WooCommerce-Integration |
| `memory/feature-tagesplanung.md` | ✅ Ja | Feature-Dokumentation |

**Test-Login nach Seeding:**
- Username: `admin`
- Password: `Admin123!`
- Email: `admin@hr-system.local`

---

## 5. TODOs & Offene Issues

### TODOs im Code (gefunden):
1. **`src/app/api/employees/[id]/portal-access/reset-password/route.ts:52`**
   ```
   // TODO: E-Mail-Versand hier ergänzen, sobald E-Mail-System integriert ist
   ```
   → E-Mail-Versand für Passwort-Reset ist noch nicht implementiert

### Bekannte Einschränkungen:
1. **Docker-Support**: In der README als "folgt in Phase 2" markiert – `docker-compose.yml` existiert aber
2. **WooCommerce**: Integration ist vorhanden, aber möglicherweise noch in Entwicklung

### Branches:
- `main` – Produktivversion
- `feature/modular-core-infrastructure` – Modulares Core-Update
- `feature/overnight-chat-module` – Nacht-Chat-Modul (in Entwicklung)

---

## 6. Datenbank-Schema (Highlights)

**Hauptmodelle:**
- `User` – Authentifizierung mit Rollen
- `Employee` – Mitarbeiterstammdaten (mit Verschlüsselung für PII)
- `Department` – Abteilungen
- `Document` – Dokumente mit Ablaufdatum
- `ClothingOrder` – Kleidungsbestellungen
- `Vacation` – Urlaube
- `DailyPlan` – Tagesplanung
- `Qualification` – Qualifikationen
- `Notification` – Benachrichtigungen
- `AuditLog` – Audit-Trail

**Verschlüsselte Felder (`@encrypted`):**
- E-Mail, Telefon
- Adresse (Straße, PLZ, Stadt)
- Sozialversicherungsnummer, Steuer-ID, Krankenversicherung

---

## Zusammenfassung

Ein **professionelles HR-System** mit Next.js/TypeScript/PostgreSQL. Gute Dokumentation, sicher durch Feldverschlüsselung und RBAC. WooCommerce-Integration für Arbeitskleidung. Nur 1 explizites TODO im Code gefunden – ansonsten wirkt es recht fertig für Phase 1.