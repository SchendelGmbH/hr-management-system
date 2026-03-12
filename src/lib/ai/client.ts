/**
 * AI Client for chat features
 * Supports OpenAI API with fallback to rule-based responses
 */

import OpenAI from 'openai';

// Initialize OpenAI client if API key is available
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Generate a summary of chat messages
 */
export async function generateSummary(messages: { content: string; sender: string }[]): Promise<string> {
  if (!openai) {
    return generateRuleBasedSummary(messages);
  }

  try {
    const chatMessages: AIMessage[] = [
      {
        role: 'system',
        content: 'Fasse die folgenden Chat-Nachrichten kurz und prägnant auf Deutsch zusammen. Extrahiere die Hauptthemen und wichtigsten Punkte. Maximal 3-4 Sätze.',
      },
      {
        role: 'user',
        content: messages.map(m => `${m.sender}: ${m.content}`).join('\n'),
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      max_tokens: 200,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content?.trim() || 'Keine Zusammenfassung verfügbar.';
  } catch (error) {
    console.error('OpenAI summary error:', error);
    return generateRuleBasedSummary(messages);
  }
}

/**
 * Generate smart reply suggestions
 */
export async function generateSmartReplies(
  recentMessages: { content: string; sender: string }[],
  context: { roomType: string; participantNames: string[] }
): Promise<string[]> {
  if (!openai) {
    return generateRuleBasedReplies(recentMessages, context);
  }

  try {
    const chatMessages: AIMessage[] = [
      {
        role: 'system',
        content: `Generiere 3 kurze, natürliche Antwortvorschläge für den Chat auf Deutsch. Die Antworten sollten professionell, aber freundlich sein. Maximal 50 Zeichen pro Antwort.`,
      },
      {
        role: 'user',
        content: `Kontext: ${context.roomType === 'DIRECT' ? 'Direktnachricht' : 'Gruppenchat'} mit ${context.participantNames.join(', ')}\n\nLetzte Nachrichten:\n${recentMessages.slice(-3).map(m => `${m.sender}: ${m.content}`).join('\n')}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      max_tokens: 150,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const replies = content
      .split('\n')
      .map(line => line.replace(/^\d+[\.)]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 3);

    return replies.length === 3 ? replies : generateRuleBasedReplies(recentMessages, context);
  } catch (error) {
    console.error('OpenAI smart replies error:', error);
    return generateRuleBasedReplies(recentMessages, context);
  }
}

/**
 * Translate text between German and Polish
 */
export async function translateText(text: string, targetLang: 'de' | 'pl'): Promise<string> {
  if (!openai) {
    return generateRuleBasedTranslation(text, targetLang);
  }

  try {
    const targetName = targetLang === 'de' ? 'Deutsch' : 'Polnisch';
    const sourceName = targetLang === 'de' ? 'Polnisch' : 'Deutsch';

    const chatMessages: AIMessage[] = [
      {
        role: 'system',
        content: `Übersetze den folgenden Text vom ${sourceName} ins ${targetName}. Behält den Ton und Kontext bei.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      max_tokens: 500,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  } catch (error) {
    console.error('OpenAI translation error:', error);
    return generateRuleBasedTranslation(text, targetLang);
  }
}

// ============ RULE-BASED FALLBACKS ============

function generateRuleBasedSummary(messages: { content: string; sender: string }[]): string {
  if (messages.length === 0) return 'Keine Nachrichten zum Zusammenfassen.';

  const topics = extractTopics(messages);
  const participants = [...new Set(messages.map(m => m.sender))];
  const questions = messages.filter(m => m.content.includes('?')).length;
  const hasTask = messages.some(m => /\/(task|aufgabe|todo)/i.test(m.content));
  
  const parts: string[] = [];
  parts.push(`Gespräch zwischen ${participants.join(', ')}.`);
  
  if (topics.length > 0) {
    parts.push(`Themen: ${topics.slice(0, 3).join(', ')}.`);
  }
  
  if (hasTask) {
    parts.push('Es wurde eine Aufgabe erstellt.');
  }
  
  if (questions > 0) {
    parts.push(`${questions} Frage(n) gestellt.`);
  }
  
  return parts.join(' ') || 'Allgemeines Gespräch.';
}

function generateRuleBasedReplies(
  recentMessages: { content: string; sender: string }[],
  context: { roomType: string; participantNames: string[] }
): string[] {
  const lastMessage = recentMessages[recentMessages.length - 1];
  if (!lastMessage) {
    return ['Hallo!', 'Wie geht es dir?', 'Schön von dir zu hören!'];
  }

  const content = lastMessage.content.toLowerCase();
  
  // Pattern matching for common scenarios
  if (content.includes('?')) {
    return ['Gute Frage, ich schaue mir das an.', 'Darüber sollten wir reden.', 'Klären wir das!'];
  }
  
  if (content.includes('ja') || content.includes('ok') || content.includes('super')) {
    return ['Perfekt!', 'Freut mich!', 'Geht klar 👍'];
  }
  
  if (content.includes('nein') || content.includes('nicht') || content.includes('problem')) {
    return ['Schade, aber verständlich.', 'Gibt es eine Alternative?', 'Kein Problem.'];
  }
  
  if (content.includes('termin') || content.includes('meeting') || content.includes('treffen')) {
    return ['Wann passt es dir?', 'Ich bin flexibel.', 'Schlage einen Termin vor.'];
  }
  
  if (content.includes('danke') || content.includes('vielen dank')) {
    return ['Gerne!', 'Immer wieder gern.', 'Kein Problem!'];
  }
  
  if (context.roomType === 'DIRECT') {
    return ['Verstanden.', 'Alles klar!', 'Ich melde mich später.'];
  }
  
  return ['Interessant!', 'Danke für die Info.', 'Wer hat noch Input?'];
}

function generateRuleBasedTranslation(text: string, targetLang: 'de' | 'pl'): string {
  // Simple bilingual dictionary for common work phrases
  const deToPl: Record<string, string> = {
    'ja': 'tak',
    'nein': 'nie',
    'danke': 'dziękuję',
    'bitte': 'proszę',
    'guten morgen': 'dzień dobry',
    'guten tag': 'dzień dobry',
    'tschüss': 'do widzenia',
    'auf wiedersehen': 'do widzenia',
    'entschuldigung': 'przepraszam',
    'wie geht es dir': 'jak się masz',
    'mir geht es gut': 'dobrze mi',
    'termin': 'spotkanie',
    'aufgabe': 'zadanie',
    'arbeit': 'praca',
    'pause': 'przerwa',
    'urlaub': 'urlop',
    'krank': 'chory',
    'verspätung': 'spóźnienie',
    'ja klar': 'jasne',
    'verstanden': 'zrozumiałem',
    'mache ich': 'zrobię to',
  };
  
  const plToDe: Record<string, string> = Object.fromEntries(
    Object.entries(deToPl).map(([de, pl]) => [pl, de])
  );

  // Try to match full phrases first
  const lowerText = text.toLowerCase().trim();
  
  if (targetLang === 'pl') {
    // Check for direct matches
    for (const [de, pl] of Object.entries(deToPl)) {
      if (lowerText === de) return pl;
      if (lowerText.includes(de)) {
        return text.replace(new RegExp(de, 'gi'), pl);
      }
    }
  } else {
    for (const [pl, de] of Object.entries(plToDe)) {
      if (lowerText === pl) return de;
      if (lowerText.includes(pl)) {
        return text.replace(new RegExp(pl, 'gi'), de);
      }
    }
  }
  
  // Return original with note if no translation found
  return targetLang === 'pl' 
    ? `${text} [PL: Tłumaczenie wymaga API]` 
    : `${text} [DE: Übersetzung erforder API]`;
}

function extractTopics(messages: { content: string; sender: string }[]): string[] {
  const keywords: Record<string, string[]> = {
    'Arbeit': ['arbeit', 'job', 'aufgabe', 'task', 'projekt'],
    'Termin': ['termin', 'meeting', 'besprechung', 'treffen', 'zeit'],
    'Probleme': ['problem', 'fehler', 'bug', 'issue', 'kaputt'],
    'Urlaub': ['urlaub', 'frei', 'krank', 'krankmeldung'],
    'Material': ['material', 'lief', 'bestellung', 'holen'],
    'Kommunikation': ['anruf', 'email', 'mail', 'nachricht'],
  };

  const foundTopics: string[] = [];
  const allText = messages.map(m => m.content.toLowerCase()).join(' ');
  
  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(word => allText.includes(word))) {
      foundTopics.push(topic);
    }
  }
  
  return foundTopics;
}

export { openai };
