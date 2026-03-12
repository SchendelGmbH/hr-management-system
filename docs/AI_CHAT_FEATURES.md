# KI-Features für Chat-Modul

Dieses Modul fügt intelligente KI-Funktionen zum Chat-System hinzu.

## Features

### 1. /summarize Befehl
Erstelle eine KI-Zusammenfassung von Chat-Verläufen.

**Verwendung:**
- Tippe `/summarize` im Chat
- Die Zusammenfassung wird als Nachricht im Chat gepostet

**Technisch:**
- Endpoint: `POST /api/ai/summarize`
- Nutzt OpenAI GPT-4o-mini (mit Fallback auf regelbasierte Zusammenfassung)
- Fasst bis zu 50 Nachrichten zusammen

### 2. Smart Replies (KI-Antwortvorschläge)
Automatische Vorschläge für schnelle Antworten basierend auf dem Chat-Kontext.

**Verwendung:**
- Werden automatisch unter dem Chat-Eingabefeld angezeigt
- 3 kontextabhängige Vorschläge
- Ein Klick fügt den Text in das Eingabefeld ein

**Technisch:**
- Endpoint: `POST /api/ai/smart-replies`
- Analysiert letzte 10 Nachrichten
- Regelbasierte Fallbacks für häufige Szenarien (Fragen, Termine, Bestätigungen)

### 3. Deutsch ↔ Polnisch Übersetzung
Übersetzung für ausländische Mitarbeiter direkt im Chat.

**Verwendung:**
- Klicke auf "Übersetzen" unter einer Nachricht
- Wähle zwischen Deutsch oder Polnisch
- Die Übersetzung wird inline angezeigt

**Technisch:**
- Endpoint: `POST /api/ai/translate`
- Endpoint: `GET /api/ai/translate?messageId=xxx&targetLang=pl`
- Regelbasiertes Wörterbuch für häufige Arbeitsphrasen als Fallback

## Konfiguration

### OpenAI API Key (Optional)
Für volle KI-Funktionalität:

```bash
# .env.local
OPENAI_API_KEY=sk-...
```

Ohne API-Key funktionieren alle Features mit regelbasierten Fallbacks.

## Dateistruktur

```
src/
├── app/api/ai/
│   ├── summarize/route.ts      # Zusammenfassung API
│   ├── smart-replies/route.ts  # Antwortvorschläge API
│   └── translate/route.ts      # Übersetzung API
├── components/chat/ai-features/
│   ├── SmartReplies.tsx        # UI für Antwortvorschläge
│   ├── TranslationButton.tsx     # UI für Übersetzung
│   └── index.ts
└── lib/ai/
    └── client.ts               # OpenAI Client + Fallback-Logik
```

## Testing

Manuelle Tests:
1. `/summarize` in einem Chat mit mehreren Nachrichten eingeben
2. Auf Smart-Replies unter dem Eingabefeld warten
3. "Übersetzen" unter einer Nachricht klicken

## Bekannte Einschränkungen

- Smart-Replies erscheinen erst nach 1 Sekunde Verzögerung (Rate-Limiting)
- Übersetzung ohne OpenAI-Key verwendet statisches Wörterbuch
- Zusammenfassungen sind beschränkt auf die letzten 50 Nachrichten

## Commits

- `ecc3f37` - feat: Add AI chat features - Smart Replies, Summarize, Translation APIs
- `e4d9460` - feat: Add TranslationButton component and integrate into MessageBubble
- `8a376c5` - feat: Integrate SmartReplies into ChatRoom and add ai-features index
- `c2bf859` - fix: Resolve TypeScript errors in AI routes - null checks and unused imports
- `fb169b3` - fix: Fix TypeScript errors in translate route and SmartReplies
