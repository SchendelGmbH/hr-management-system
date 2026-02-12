# 🚀 HR Management System - Startanleitung

## Voraussetzungen

Stellen Sie sicher, dass folgende Software installiert ist:

- **Node.js** (Version 18 oder höher)
- **PostgreSQL** (Version 14 oder höher)
- **npm** oder **yarn** Package Manager

## 📋 Schritt-für-Schritt Anleitung

### 1. Datenbank vorbereiten

Öffnen Sie ein Terminal und starten Sie PostgreSQL:

```bash
# Windows: PostgreSQL sollte als Service laufen
# Oder manuell starten mit:
pg_ctl -D "C:\Program Files\PostgreSQL\17\data" start
```

Stellen Sie sicher, dass die Datenbank `hr_management` existiert und läuft.

### 2. Projekt-Verzeichnis öffnen

```bash
cd "H:\Desktop\Claude Test Web App\hr-management-system"
```

### 3. Dependencies installieren (falls noch nicht geschehen)

```bash
npm install --legacy-peer-deps
```

### 4. Umgebungsvariablen prüfen

Prüfen Sie, ob die `.env` Datei existiert und folgende Werte enthält:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr_management"
NEXTAUTH_SECRET="[Ihr Secret]"
NEXTAUTH_URL="http://localhost:3000"
```

### 5. Datenbank initialisieren (falls noch nicht geschehen)

```bash
# Prisma Client generieren
npx prisma generate

# Datenbank migrieren
npx prisma migrate dev

# Seed-Daten einfügen
npx prisma db seed
```

### 6. Entwicklungsserver starten

```bash
npm run dev
```

Der Server startet auf: **http://localhost:3000**

### 7. Anmeldung

Öffnen Sie Ihren Browser und navigieren Sie zu:
```
http://localhost:3000
```

**Standard-Login:**
- **Benutzername:** `admin`
- **Passwort:** `Admin123!`

---

## 🎯 Hauptfunktionen im Überblick

### Dashboard
- Übersicht über Mitarbeiter, ablaufende Dokumente und Urlaube
- Statistiken auf einen Blick

### Mitarbeiter
- **Mitarbeiterliste:** Alle Mitarbeiter anzeigen, suchen und filtern
- **Neuer Mitarbeiter:** Mitarbeiter anlegen mit automatischer Personalnummer
- **Mitarbeiter-Details:** Vollständige Informationen, Dokumente, Bestellungen

### Dokumente
- **Dokumentenliste:** Alle Dokumente mit Ablaufstatus
- **Dokument hochladen:** Neue Dokumente hochladen (PDF, JPG, PNG, DOCX)
- **Filter:** Nach Status filtern (Gültig, Läuft bald ab, Abgelaufen)

### Arbeitskleidung
- **Bestellungen:** Alle Bestellungen anzeigen
- **Neue Bestellung:** Bestellung erstellen mit Budget-Tracking
- **Status:** BESTELLT, GELIEFERT, RETOURNIERT

### Kalender / Urlaub
- **Urlaubsliste:** Alle Urlaube anzeigen
- **Urlaub hinzufügen:** Neuen Urlaub anlegen
- **Urlaubsarten:** Urlaub, Krankheit, Sonderurlaub

### Benachrichtigungen
- **Dropdown:** Ungelesene Benachrichtigungen im Header
- **Benachrichtigungsseite:** Alle Benachrichtigungen verwalten
- **Filter:** Alle, Ungelesen, Gelesen

### Einstellungen
- **Abteilungen:** Abteilungen verwalten und erstellen
- **Dokumenttypen:** Dokumenttypen konfigurieren
- **Audit-Log:** Alle Systemänderungen nachverfolgen

---

## 🛠️ Nützliche Befehle

### Entwicklung
```bash
npm run dev          # Entwicklungsserver starten
npm run build        # Produktions-Build erstellen
npm run start        # Produktionsserver starten
```

### Datenbank
```bash
npx prisma studio    # Datenbank-GUI öffnen
npx prisma migrate dev --name beschreibung  # Neue Migration erstellen
npx prisma db push   # Schema ohne Migration pushen
npx prisma db seed   # Seed-Daten einfügen
```

### Code-Qualität
```bash
npm run lint         # Code-Linting
```

---

## 📊 Test-Daten

Nach dem Seeding sind folgende Test-Daten verfügbar:

**Mitarbeiter:** 5 Test-Mitarbeiter (EMP-00001 bis EMP-00005)
**Abteilungen:** 5 Abteilungen (IT, HR, Verkauf, Produktion, Marketing)
**Dokumenttypen:** 8 verschiedene Typen
**Arbeitskleidung:** 5 verschiedene Artikel

---

## ❗ Fehlerbehebung

### "Port 3000 ist bereits belegt"
```bash
# Windows: Prozess auf Port 3000 finden und beenden
netstat -ano | findstr :3000
taskkill /PID <PID-Nummer> /F
```

### "Datenbank-Verbindungsfehler"
- Prüfen Sie, ob PostgreSQL läuft
- Prüfen Sie die DATABASE_URL in der .env Datei
- Stellen Sie sicher, dass die Datenbank "hr_management" existiert

### "Prisma Client ist nicht generiert"
```bash
npx prisma generate
```

### "Module nicht gefunden"
```bash
npm install --legacy-peer-deps
```

---

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfen Sie diese Anleitung
2. Schauen Sie in die Konsole nach Fehlermeldungen
3. Prüfen Sie die Logs im Terminal

---

## 🔐 Sicherheitshinweise

⚠️ **Wichtig für Produktion:**
- Ändern Sie das Standard-Passwort
- Verwenden Sie ein sicheres NEXTAUTH_SECRET
- Aktivieren Sie HTTPS
- Konfigurieren Sie Datenbank-Backups
- Überprüfen Sie Datei-Upload-Limits

---

**Viel Erfolg mit Ihrem HR Management System! 🎉**
