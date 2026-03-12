/**
 * VERTRETUNGS-FINDER - Feature Dokumentation
 * 
 * Das Vertretungs-Modul wurde als Teil des overnight-chat-module Features entwickelt.
 * Es ermöglicht automatische Vertretungsvorschläge bei Krankmeldungen.
 * 
 * ==============================================================================
 * FEATURES
 * ==============================================================================
 * 
 * 1. AUTOMATISCHE VORSCHLÄGE BEI KRANKMELDUNG
 *    - Wird ein Mitarbeiter mit Type=SICK eingetragen, erstellt das System
 *      automatisch einen Chat-Raum mit Vertretungsvorschlägen
 *    - EventBus-Integration: vacation.created → automatische Verarbeitung
 * 
 * 2. SMART MATCHING ALGORITHMUS
 *    - Score-basiertes Ranking:
 *      • Gleiche Abteilung: +20 Punkte
 *      • Gleiche Baustelle: +30 Punkte  
 *      • Passende Qualifikationen: +25 Punkte pro Match (max 50)
 *      • Hat Arbeitsplanung: +10 Punkte
 *    - Verfügbarkeits-Check: Urlaub/Krankheit wird ausgeschlossen
 * 
 * 3. EIN-KLICK ANFRAGE
 *    - Direkte Anfrage an Vertretung über Button
 *    - Automatische Notification + Chat-Erstellung
 *    - Einträge im Audit-Log
 * 
 * 4. HR DASHBOARD
 *    - Übersicht aller offenen Vertretungen
 *    - Status: Aktiv (laufend) vs. Abgeschlossen
 *    - Direkte Chat-Navigation
 * 
 * ==============================================================================
 * API ENDPOINTS
 * ==============================================================================
 * 
 * POST /api/vertretung/suchen
 *   Input: { krankerMitarbeiterId, startDatum, endDatum }
 *   Output: { krankerMitarbeiter, zeitraum, vorschlaege[], alternative[] }
 * 
 * POST /api/vertretung/anfragen
 *   Input: { vertretungsMitarbeiterId, krankerMitarbeiterId, startDatum, endDatum, nachricht? }
 *   Output: { success, message, chatRoomId? }
 * 
 * GET /api/vertretung/offen
 *   Output: { offeneVertretungen[], meta: { total, active, past } }
 * 
 * ==============================================================================
 * EVENTS
 * ==============================================================================
 * 
 * Emitted:
 *   - vacation.created (bei Krankmeldung in /api/vacations)
 *   - vertretung.vorschlag.erstellt (nach Chat-Erstellung)
 *   - vertretung.anfrage.gesendet (nach Einzel-Anfrage)
 * 
 * ==============================================================================
 * KOMPONENTEN
 * ==============================================================================
 * 
 * - VertretungVorschlaege: Zeigt Vorschläge mit Scores an
 * - VertretungsDashboard: HR-Übersicht aller Vertretungen
 * - useVertretung: React Hook für API-Calls
 * 
 * ==============================================================================
 * DATENFLUSS
 * ==============================================================================
 * 
 * 1. HR trägt Krankmeldung ein (/vacations, Type=SICK)
 * 2. vacation.created Event wird emitted
 * 3. VertretungEventHandler reagiert:
 *    a) Sucht passende Vertretungen via internen Algorithmus
 *    b) Erstellt Chat-Raum mit allen Vorschlägen
 *    c) Sendet System-Nachrichten mit Details
 * 4. HR sieht neuen Chat und kann Ein-Klick-Anfragen senden
 * 
 * ==============================================================================
 * ERLEDIGT BIS 6 UHR
 * ==============================================================================
 * 
 * ✅ POST /api/vertretung/suchen Endpoint
 * ✅ Algorithmus: Wer hat frei + Qualifikation + Nähe
 * ✅ EventBus: Automatische Vorschläge bei Krankmeldung
 * ✅ UI: Vorschläge anzeigen mit Ein-Klick-Anfrage
 * ✅ Bonus: Dashboard für HR-Übersicht
 * 
 * Branch: feature/overnight-chat-module
 * Commits: 3 (38f1497, 569195f, 5885b9b)
 */

export const VERTRETUNG_FEATURE_BUILT = '2026-03-12T06:00:00+01:00';
export const VERTRETUNG_STATUS = '✅ FERTIG';
