/**
 * Database-backed Rate-Limiter for Login attempts.
 * Survives server restarts unlike the previous in-memory Map.
 */

import prismaBase from '@/lib/prisma-base';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Checks if a login attempt is allowed.
 * @param identifier Username or IP address
 * @returns true if allowed, false if blocked
 */
export async function checkLoginRateLimit(identifier: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  // Clean up old entries first (older than one window)
  await prismaBase.$executeRawUnsafe(
    `DELETE FROM rate_limits WHERE "windowStart" < $1`,
    windowStart
  );

  // Get or create rate limit record
  const result = await prismaBase.$queryRawUnsafe<{ attemptCount: bigint }[]>(
    `INSERT INTO rate_limits (identifier, endpoint, "attemptCount", "windowStart")
     VALUES ($1, 'login', 1, $2)
     ON CONFLICT (identifier, endpoint)
     DO UPDATE SET "attemptCount" = rate_limits."attemptCount" + 1, "windowStart" = rate_limits."windowStart"
     WHERE rate_limits."windowStart" > $2
     RETURNING rate_limits."attemptCount"`,
    identifier,
    windowStart
  );

  const count = result.length > 0 ? Number(result[0].attemptCount) : 1;
  return count <= MAX_ATTEMPTS;
}

/**
 * Resets rate limit counter after successful login.
 */
export async function resetLoginRateLimit(identifier: string): Promise<void> {
  await prismaBase.$executeRawUnsafe(
    `DELETE FROM rate_limits WHERE identifier = $1 AND endpoint = 'login'`,
    identifier
  );
}

/**
 * Returns remaining block time in seconds (0 if not blocked).
 */
export async function getRetryAfterSeconds(identifier: string): Promise<number> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const result = await prismaBase.$queryRawUnsafe<{ attemptCount: bigint; windowStart: Date }[]>(
    `SELECT "attemptCount", "windowStart" FROM rate_limits
     WHERE identifier = $1 AND endpoint = 'login' AND "windowStart" > $2`,
    identifier,
    windowStart
  );

  if (result.length === 0 || Number(result[0].attemptCount) < MAX_ATTEMPTS) return 0;

  const resetAt = result[0].windowStart.getTime() + WINDOW_MS;
  return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
}