/**
 * Einfacher In-Memory Rate-Limiter für Login-Versuche.
 * Verhindert Brute-Force-Angriffe: max. 5 Fehlversuche pro 15 Minuten.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 Minuten
const MAX_ATTEMPTS = 5;

interface AttemptRecord {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, AttemptRecord>();

/**
 * Prüft ob ein Login-Versuch erlaubt ist.
 * @param identifier Username oder IP-Adresse
 * @returns true wenn der Versuch erlaubt ist, false wenn gesperrt
 */
export function checkLoginRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = attempts.get(identifier);

  if (!record || record.resetAt < now) {
    attempts.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Setzt den Rate-Limit-Zähler nach erfolgreichem Login zurück.
 */
export function resetLoginRateLimit(identifier: string): void {
  attempts.delete(identifier);
}

/**
 * Gibt die verbleibende Sperrzeit in Sekunden zurück (0 wenn nicht gesperrt).
 */
export function getRetryAfterSeconds(identifier: string): number {
  const now = Date.now();
  const record = attempts.get(identifier);
  if (!record || record.count < MAX_ATTEMPTS || record.resetAt < now) return 0;
  return Math.ceil((record.resetAt - now) / 1000);
}
