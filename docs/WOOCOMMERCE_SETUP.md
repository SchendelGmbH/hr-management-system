# WooCommerce Integration Setup

## Voraussetzungen

1. **WooCommerce-Shop mit REST API**
   - WordPress mit WooCommerce installiert
   - Permalinks auf "Post name" oder Custom (nicht "Plain")
   - PHP memory_limit mindestens 256MB (empfohlen 512MB)

2. **HTTPS-Verbindung**
   - SSL-Zertifikat auf WooCommerce-Shop installiert
   - HTTPS-Zugriff aktiv

## Setup-Schritte

### 1. WooCommerce API Key erstellen

1. Gehe zu **WooCommerce > Einstellungen > Erweitert > REST API**
2. Klicke **API-Schlüssel hinzufügen**
3. Beschreibung: "HR Management System Import"
4. Benutzer: Admin-User auswählen
5. Berechtigungen: **Lesen/Schreiben**
6. **API-Schlüssel generieren**
7. Kopiere **Consumer Key** und **Consumer Secret** (werden nur einmal angezeigt!)

### 2. Environment Variables konfigurieren

Füge in `.env` (root directory) hinzu:

```env
WOOCOMMERCE_URL=https://dein-shop.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxx
```

**WICHTIG**: `.env` ist in `.gitignore` und darf NICHT committed werden!

### 3. Mitarbeiter mit WooCommerce Customers verknüpfen

**Option A: Custom Field (empfohlen)**

1. Gehe zu **Einstellungen > Custom Fields** im HR-System
2. Feld sollte automatisch existieren: `woocommerce_customer_id`
3. Für jeden Mitarbeiter:
   - Bearbeite Mitarbeiter-Detail
   - Tab "Stammdaten"
   - Custom Field "woocommerce_customer_id" ausfüllen mit WC Customer ID
   - WC Customer ID findest du: WooCommerce > Kunden > ID in URL oder Liste

**Option B: Email-Matching**

1. Stelle sicher, dass `Employee.email` = WooCommerce Billing Email
2. Keine weiteren Schritte nötig

### 4. Artikel-Katalog mit SKUs versehen

1. Gehe zu **Artikelkatalog** im HR-System
2. Für jeden Artikel:
   - Bearbeite Artikel
   - Feld "SKU" ausfüllen (muss mit WooCommerce Product SKU übereinstimmen!)
   - Speichern

**SKU-Matching überprüfen:**
- WooCommerce Product SKU: siehe Produkt-Details
- HR System SKU: siehe Artikel-Katalog

### 5. Größen-Attribute in WooCommerce

Stelle sicher, dass Produkte in WooCommerce Größen-Attribute haben:

1. WooCommerce > Produkte > Attribute
2. Erstelle Attribut "Size" oder "Größe" (slug: `pa_size`)
3. Bei jedem Produkt:
   - Attributes-Tab: Größen hinzufügen (z.B. XS, S, M, L, XL)
   - Variations: Größen-Varianten erstellen

**Wichtig**: Attribut-Key muss `pa_size`, `Size`, oder `Größe` sein!

### 6. Test-Import durchführen

1. Gehe zu **WooCommerce Import** im HR-System
2. Filter: Status = "completed", Von Datum = letzte 7 Tage
3. Klicke "Bestellungen importieren"
4. Prüfe Ergebnis:
   - Importierte Bestellungen
   - Fehler-Log

## Troubleshooting

### Fehler: "No employee found for WooCommerce customer"

**Lösung:**
- Prüfe Custom Field `woocommerce_customer_id` beim Mitarbeiter
- Oder: Prüfe Email-Übereinstimmung (Employee.email = WC Billing Email)

### Fehler: "SKU 'XXX' not found in ClothingItems"

**Lösung:**
- Gehe zu Artikel-Katalog
- Erstelle neuen Artikel mit genau dieser SKU
- Oder: Korrigiere SKU bei bestehendem Artikel

### Fehler: "No size found in meta_data"

**Lösung:**
- WooCommerce Produkt muss Größen-Attribut haben
- Attribut-Key muss `pa_size`, `Size`, oder `Größe` sein
- Varianten müssen Größen-Werte haben

### Fehler: "Size 'XL' not available for item"

**Lösung:**
- Gehe zu Artikel-Detail im HR-System
- Füge Größe "XL" zu `availableSizes` hinzu
- Speichern

### Fehler: "WooCommerce credentials not configured"

**Lösung:**
- Prüfe `.env`-Datei im root directory
- Stelle sicher, dass alle 3 Variables gesetzt sind
- Server neu starten: `npm run dev` (Development)

### Import läuft sehr langsam

**Lösung:**
- Nutze engere Datumsgrenzen (z.B. nur letzte 30 Tage)
- Erhöhe PHP memory_limit auf WooCommerce-Server (512MB+)
- Prüfe Netzwerk-Latenz zwischen HR-System und WC-Shop

## Best Practices

1. **Erste Import**: Importiere zunächst nur letzte 30 Tage zum Testen
2. **Regelmäßiger Import**: Einmal wöchlich oder monatlich
3. **Duplikate**: Werden automatisch übersprungen (kein Problem)
4. **Budget-Check**: Bei "completed"-Bestellungen wird Budget SOFORT abgezogen!
5. **Audit-Trail**: Alle Importe werden im Audit-Log erfasst
6. **Fehler-Log**: Bei Fehlern: Screenshot speichern und Fehler-Details analysieren

## Sicherheit

- **NIEMALS** API Keys in Git commiten
- **NIEMALS** `.env`-Datei teilen
- **Nur HTTPS** verwenden (HTTP nicht unterstützt für Basic Auth)
- **Separate API Keys** für Dev/Staging/Production
- **Read/Write-Berechtigung** nur für Import-User

## Status-Mapping

| WooCommerce Status | HR System Status | Auswirkung |
|--------------------|------------------|------------|
| `completed` | DELIVERED | Budget wird sofort abgezogen |
| `processing` | ORDERED | Keine Budget-Änderung |
| `on-hold` | ORDERED | Keine Budget-Änderung |
| `refunded` | RETURNED | Budget wird zurückgegeben |
| `pending` | ORDERED | Keine Budget-Änderung |
| `cancelled` | Wird nicht importiert | - |
| `failed` | Wird nicht importiert | - |

## Mitarbeiter-Mapping Strategien

### Strategie 1: Custom Field (Empfohlen)
- Eindeutige Zuordnung
- Setup erforderlich, aber zuverlässig
- Custom Field `woocommerce_customer_id` bei jedem Mitarbeiter setzen

### Strategie 2: Email-Matching (Fallback)
- Automatisch
- Funktioniert nur wenn Email eindeutig ist
- Weniger zuverlässig bei mehreren Employees mit gleicher Email

## Fehlerbehebung bei Import

Wenn Import fehlschlägt, prüfe in dieser Reihenfolge:

1. **Environment Variables korrekt?**
   - `.env` Datei vorhanden?
   - Alle 3 WooCommerce-Variablen gesetzt?
   - Server neu gestartet nach `.env`-Änderungen?

2. **WooCommerce API erreichbar?**
   - URL korrekt (mit https://)?
   - API Key funktioniert?
   - Test: Browser-Aufruf mit Basic Auth

3. **Mitarbeiter-Mapping funktioniert?**
   - Custom Field bei Mitarbeiter gesetzt?
   - Email stimmt überein?

4. **SKU-Matching funktioniert?**
   - SKU in HR-System vorhanden?
   - SKU exakt identisch (inkl. Groß-/Kleinschreibung)?

5. **Größen vorhanden?**
   - WooCommerce Produkt hat Größen-Attribute?
   - Größen in HR-System `availableSizes` enthalten?

## Erweiterte Konfiguration

### Automatischer Import (Optional)

Für automatischen täglichen Import, erstelle einen Cron Job:

```bash
0 2 * * * curl -X POST http://your-hr-system.com/api/woocommerce/import-orders \
  -H "Content-Type: application/json" \
  -d '{"status":"completed,processing","after":"2024-01-01T00:00:00"}'
```

### Webhook-Support (Zukünftig)

Für Echtzeit-Import können WooCommerce Webhooks konfiguriert werden:
- Event: Order created
- URL: `https://your-hr-system.com/api/woocommerce/webhook`
- Secret: Definieren in Environment Variables

## Support

Bei Problemen:
1. Prüfe Fehler-Log im Import-Result
2. Prüfe Audit-Log in Einstellungen
3. Prüfe Server-Logs (Console)
4. Kontaktiere Support mit:
   - Screenshot der Fehlermeldung
   - WooCommerce Order ID
   - HR System Version

## Changelog

### Version 1.0 (2026-02-12)
- Initiale WooCommerce-Integration
- Manueller Import mit Filtern
- Custom Field Mapping
- Email Fallback Mapping
- SKU-basiertes Produkt-Matching
- Status-Mapping
- Budget-Tracking bei DELIVERED
