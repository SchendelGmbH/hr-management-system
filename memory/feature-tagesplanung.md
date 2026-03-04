# Feature: Tagesplanung (Daily Work Planning)

## Key Files
- `src/app/[locale]/planning/[date]/page.tsx` — Main planning UI (complex)
- `src/app/[locale]/planning/page.tsx` — Redirect to today
- `src/app/[locale]/settings/work-sites/page.tsx` — Stammbaustellen management
- `src/app/api/daily-plans/[date]/route.ts` — GET (template) + PUT (upsert)
- `src/app/api/work-sites/route.ts` — GET with 30-day cleanup
- `src/app/api/work-sites/[id]/route.ts` — DELETE
- `scripts/seed-work-sites.ts` — 10 initial work sites seeded

## DB Models Added
- `WorkSite` — Stammbaustellen, auto-managed (@@unique [name, location])
- `DailyPlan` — One per date (@@unique [date])
- `DailyPlanSite` — Baustelle within a day's plan
- `DailyPlanAssignment` — Employee ↔ site assignment (@@unique [siteId, employeeId])
- Added `SCHOOL`, `SCHOOL_BLOCK` to VacationType enum

## Core Concepts
- **Auto-WorkSite management**: WorkSites are upserted automatically on every PUT save.
  After 30 days without use (`lastUsedAt < cutoff`) they are auto-deleted. No manual Settings creation needed.
- **Yesterday as template**: GET checks for existing plan; if none found, loads previous day
  with `isTemplate: true`. Nothing is saved until first PUT (first user change).
- **Auto-save**: Every UI change immediately fires PUT; no manual save button.
- **Baustelle upsert key**: `name_location` compound unique (empty string "" used for null location in upsert).

## Planning UI Patterns
- 2-column layout: left (Baustellen cards) + right (Mitarbeiter-Pool + Abwesenheiten)
- Click employee in pool → instruction banner appears → click Baustelle to assign
- Autocomplete dropdown for site name from WorkSites list (prefills location/plate/times)
- Inline note editing per employee in a Baustelle
- Print area (`#print-area`) hidden on screen, visible when printing with `@media print`
- Print layout matches paper version: table + right count list + bottom absences table

## VacationType Labels (for display)
- VACATION → "Urlaub"
- SICK → "Krank"
- SPECIAL → "Sonderurlaub"
- SCHOOL → "Schule"
- SCHOOL_BLOCK → "UBL"

## AddVacationModal
- Modal title changed from "Neuer Urlaub" → "Neue Abwesenheit"
- Label changed from "Urlaubsart" → "Abwesenheitsart"
- Added SCHOOL and SCHOOL_BLOCK options to the type selector
