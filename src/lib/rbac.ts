import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';

type AccessLevel = 'none' | 'read' | 'write';

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

type PermissionResult =
  | { allowed: true; access: AccessLevel }
  | { allowed: false; error: NextResponse };

/**
 * Prüft ob ein User mit gegebener Rolle eine bestimmte Berechtigung hat.
 *
 * @param role       - z.B. 'USER', 'ADMIN', 'GEWERBLICH', 'PERSONALER'
 * @param module     - z.B. 'employees', 'vacations', 'documents'
 * @param action     - z.B. 'view', 'create', 'edit', 'delete'
 * @param method     - HTTP-Methode ('GET' = read, alles andere = write)
 */
export async function checkPermission(
  role: string,
  module: string,
  action: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
): Promise<PermissionResult> {
  const required: AccessLevel = method === 'GET' ? 'read' : 'write';

  const permission = await prisma.rolePermission.findUnique({
    where: { role_module_action: { role, module, action } },
  });

  if (!permission) {
    // Kein Eintrag = keine Berechtigung
    return {
      allowed: false,
      error: NextResponse.json(
        { error: `Keine Berechtigung für ${module}:${action}` },
        { status: 403 }
      ),
    };
  }

  const access = permission.access as AccessLevel;

  // 'none' darf nie
  if (access === 'none') {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: `Keine Berechtigung für ${module}:${action}` },
        { status: 403 }
      ),
    };
  }

  // 'read' reicht für GET, reicht nicht für POST/PUT/PATCH/DELETE
  if (access === 'read' && required === 'write') {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: `Nur Lese-Zugriff für ${module}:${action}` },
        { status: 403 }
      ),
    };
  }

  return { allowed: true, access };
}

/**
 * Shorthand: prüft only-read (GET) Zugriff
 */
export async function canRead(role: string, module: string, action: string) {
  return checkPermission(role, module, action, 'GET');
}

/**
 * Shorthand: prüft write (POST/PUT/DELETE) Zugriff
 */
export async function canWrite(role: string, module: string, action: string) {
  return checkPermission(role, module, action, 'POST');
}