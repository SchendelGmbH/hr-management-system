# Navigation & Menü-Status Übersicht

**Datum:** 13.03.2026  
**Geprüft:** Sidebar.tsx vs. existierende Routes

---

## ✅ Vorhanden (Menü + Route existieren)

| Menüpunkt | Route | Icon | Status |
|-----------|-------|------|--------|
| Dashboard | `/de` | LayoutDashboard | ✅ |
| Mitarbeiter | `/de/employees` | Users | ✅ |
| Dokumente | `/de/documents` | FileText | ✅ |
| Bestellungen | `/de/clothing/orders` | ShoppingCart | ✅ |
| Kleidungsstücke | `/de/clothing/items` | Package | ✅ |
| WooCommerce Import | `/de/clothing/woocommerce-import` | Download | ✅ |
| Kalender | `/de/calendar` | Calendar | ✅ |
| Einsatzplanung | `/de/planning` | ClipboardList | ✅ |
| Qualifikationen | `/de/qualifications` | Award | ✅ |
| Mein Dienstplan | `/de/my-schedule` | Calendar | ✅ |
| Chat | `/de/chat` | MessageCircle | ✅ |
| Aufgaben | `/de/tasks` | LayoutKanban | ✅ |
| Einstellungen | `/de/settings` | Settings | ✅ |

**Gesamt:** 13 funktionierende Menüpunkte

---

## ❌ Fehlend (Menüpunkt existiert, aber Route fehlt)

| Menüpunkt | Route (im Code) | Status | Problem |
|-----------|-----------------|--------|---------|
| **Schichttausch** | `/de/swaps` | ❌ **404** | Ordner `src/app/[locale]/swaps/` fehlt komplett |

**Impact:** User klicken auf "Schichttausch" und bekommen 404-Fehler

---

## 📊 Unter-Routes (dynamisch)

### Chat (/de/chat)
- `/chat` - Übersicht
- `/chat/[roomId]` - Einzelner Chat-Raum

### Einsatzplanung (/de/planning)
- `/planning` - Übersicht
- `/planning/[date]` - Tagesplanung

### Einstellungen (/de/settings)
- `/settings` - Übersicht
- `/settings/notifications` - Benachrichtigungen
- `/settings/modules` - Modul-Verwaltung
- `/settings/license` - Lizenz
- `/settings/users` - Benutzer
- `/settings/roles` - Rollen
- `/settings/audit` - Audit-Log
- `/settings/system` - System

---

## 🔧 Empfohlene Fixes

### 1. Schichttausch-Feature erstellen

**Option A:** Route erstellen (wenn Feature gewünscht)
```bash
mkdir -p src/app/[locale]/swaps
# page.tsx, layout.tsx erstellen
```

**Option B:** Menüpunkt entfernen (wenn Feature nicht gewünscht)
```typescript
// Sidebar.tsx - 'swaps' aus allNavigation entfernen
{
  name: 'swaps',      // <-- DIESEN EINTRAG ENTFERNEN
  href: '/de/swaps',
  icon: ArrowRightLeft,
  adminOnly: false,
},
```

### 2. Modul-basierte Navigation (optional)

Statt statischer Liste in Sidebar.tsx, könnte die Navigation dynamisch aus der **ModuleRegistry** generiert werden:

```typescript
// Beispiel:
const modules = moduleRegistry.getActiveModules();
const navigation = modules.flatMap(m => m.navigation);
```

**Vorteile:**
- Nur aktivierte Module erscheinen im Menü
- Lizenz-gesteuerte Menüpunkte
- Keine hartkodierten Listen

**Nachteile:**
- Mehr Aufwand
- Übersetzungen müssen aus Modulen kommen

---

## 🎯 Zusammenfassung

| Kategorie | Anzahl |
|-----------|--------|
| **Funktionierende Menüpunkte** | 13 ✅ |
| **Fehlende Routes** | 1 ❌ (swaps) |
| **Dynamische Unter-Routes** | 5+ ✅ |

### Sofortige Aktion empfohlen:
1. **[ ]** `src/app/[locale]/swaps/page.tsx` erstellen - ODER -
2. **[ ]** Swaps-Menüpunkt aus Sidebar.tsx entfernen
3. **[ ]** Test: Alle Menüpunkte klicken und 404s prüfen

---

**Wichtig:** Der `CalendarIcon` in der Sidebar ist nicht importiert (vermutlich sollte es `Calendar` sein):
```typescript
// Sidebar.tsx Zeile 79:
icon: CalendarIcon,  // ❌ existiert nicht
// Sollte sein:
icon: Calendar,     // ✅ existiert
```
