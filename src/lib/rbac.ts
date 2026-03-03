import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';

type AuthResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

/**
 * Prüft ob der Benutzer eingeloggt ist.
 * Gibt session zurück oder einen 401-Response.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, error: null };
}

/**
 * Prüft ob der Benutzer eingeloggt ist UND die Rolle "ADMIN" hat.
 * Gibt session zurück oder einen 401/403-Response.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'ADMIN') {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session, error: null };
}
