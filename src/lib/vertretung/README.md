# 🚑 Vertretungs-Finder

Automatische Vertretungsvorschläge bei Krankmeldungen. Baut auf dem EventBus und Chat-System auf.

## Schnellstart

```typescript
// In einer Komponente:
import { VertretungVorschlaege, VertretungsDashboard } from '@/components/vertretung';

// Vertretungsvorschläge anzeigen
<VertretungVorschlaege
  krankerMitarbeiterId="emp-123"
  startDatum="2026-03-12"
  endDatum="2026-03-14"
/>

// HR Dashboard für alle Vertretungen
<VertretungsDashboard />
```

## API

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/vertretung/suchen` | POST | Findet Vertretungen |
| `/api/vertretung/anfragen` | POST | Sendet Anfrage |
| `/api/vertretung/offen` | GET | Alle offenen Vertretungen |

## Algorithmus

Der Matching-Algorithmus berechnet einen Score (0-100):

- **Gleiche Abteilung**: +20 Punkte
- **Gleiche Baustelle**: +30 Punkte
- **Passende Qualifikationen**: +25 Punkte pro Match (max 50)
- **Hat Arbeitsplanung**: +10 Punkte

Nicht verfügbare Mitarbeiter (Urlaub/Krank) werden ausgeschlossen.

## Automatisierung

Wenn eine Krankmeldung eingetragen wird:

1. Event `vacation.created` wird emitted
2. VertretungEventHandler sucht automatisch
3. Chat-Raum mit Vorschlägen wird erstellt
4. HR bekommt Notification

## Entwickelt

Über Nacht, 12.03.2026, bis 6 Uhr fertig.
