import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { Session } from 'next-auth';

type AccessLevel = 'none' | 'read' | 'write';

type AuthResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

/** ADMIN-Rollenamen (hardcoded, da Role-Tabelle selbst geschützt werden muss) */
const ADMIN_ROLE_NAME = 'ADMIN';

/** Hole Role-Name aus der DB anhand roleId */
async function getRoleName(roleId: string | null | undefined): Promise<string | null> {
  if (!roleId) return null;
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
  return role?.name ?? null;
}

/** Ist die Rolle ein ADMIN? (Role.name === 'ADMIN') - nutzt DB */
async function isAdmin(roleId: string | null | undefined): Promise<boolean> {
  const name = await getRoleName(roleId ?? null);
  return name === ADMIN_ROLE_NAME;
}

/** Ist die Session ein ADMIN? - nutzt roleName aus JWT (kein DB-Call) */
export function isAdminFromSession(session: { roleName?: string | null } | null): boolean {
  return session?.roleName === ADMIN_ROLE_NAME;
}

// ──────────────────────────────────────────────
// Auth-Checks
// ──────────────────────────────────────────────

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireAdmin(): Promise<AuthResult> {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const admin = await isAdmin(session.user.roleId);
  if (!admin) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session, error: null };
}

// ──────────────────────────────────────────────
// Permission-Checks
// ──────────────────────────────────────────────

type PermissionResult =
  | { allowed: true; access: AccessLevel }
  | { allowed: false; error: NextResponse };

/**
 * Prüft ob eine Rolle (roleId) eine bestimmte Berechtigung hat.
 *
 * @param roleId    - FK → Role.id
 * @param module    - z.B. 'employees', 'vacations', 'settings'
 * @param action    - z.B. 'view', 'create', 'edit', 'delete'
 * @param method    - HTTP-Methode ('GET' = read, alles andere = write)
 */
export async function checkPermission(
  roleId: string | null | undefined,
  module: string,
  action: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
): Promise<PermissionResult> {
  // ADMIN hat immer alles
  if (await isAdmin(roleId)) {
    return { allowed: true, access: 'write' };
  }

  if (!roleId) {
    return {
      allowed: false,
      error: NextResponse.json({ error: `Keine Berechtigung für ${module}:${action}` }, { status: 403 }),
    };
  }

  const required: AccessLevel = method === 'GET' ? 'read' : 'write';

  const permission = await prisma.rolePermission.findUnique({
    where: { roleId_module_action: { roleId, module, action } },
  });

  if (!permission) {
    return {
      allowed: false,
      error: NextResponse.json({ error: `Keine Berechtigung für ${module}:${action}` }, { status: 403 }),
    };
  }

  const access = permission.access as AccessLevel;

  if (access === 'none') {
    return {
      allowed: false,
      error: NextResponse.json({ error: `Keine Berechtigung für ${module}:${action}` }, { status: 403 }),
    };
  }

  if (access === 'read' && required === 'write') {
    return {
      allowed: false,
      error: NextResponse.json({ error: `Nur Lese-Zugriff für ${module}:${action}` }, { status: 403 }),
    };
  }

  return { allowed: true, access };
}

/** Shorthand: prüft only-read (GET) Zugriff */
export async function canRead(roleId: string | null | undefined, module: string, action: string) {
  return checkPermission(roleId, module, action, 'GET');
}

/** Shorthand: prüft write (POST/PUT/DELETE) Zugriff */
export async function canWrite(roleId: string | null | undefined, module: string, action: string) {
  return checkPermission(roleId, module, action, 'POST');
}

/**
 * Wrapper: Auth-Check + Permission-Check in einem.
 * Nutzt die HTTP-Methode automatic für action mapping.
 * ADMIN hat automatisch alle Permissions.
 */
export async function requirePermission(
  request: NextRequest,
  module: string,
  actionOverride?: string
): Promise<AuthResult> {
  const session = await auth();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const method = request.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  const action = actionOverride || (method === 'GET' ? 'view' : 'create');

  const result = await checkPermission(session.user.roleId, module, action, method);
  if (!result.allowed) {
    return { session: null, error: result.error };
  }

  return { session, error: null };
}

// ──────────────────────────────────────────────
// Sidebar-Navigation: RBAC-Filterung
// ──────────────────────────────────────────────

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  modules: string[];
}

export async function getAccessibleNav(
  roleId: string | null | undefined,
  userId: string
): Promise<NavItem[]> {
  const allNav: NavItem[] = [
    { name: 'dashboard', href: '/de', icon: 'LayoutDashboard', modules: [] },
    { name: 'employees', href: '/de/employees', icon: 'Users', modules: ['employees'] },
    { name: 'documents', href: '/de/documents', icon: 'FileText', modules: ['documents'] },
    { name: 'orders', href: '/de/clothing/orders', icon: 'ShoppingCart', modules: ['clothing'] },
    { name: 'items', href: '/de/clothing/items', icon: 'Package', modules: ['clothing'] },
    { name: 'woocommerceImport', href: '/de/clothing/woocommerce-import', icon: 'Download', modules: ['clothing'] },
    { name: 'calendar', href: '/de/calendar', icon: 'Calendar', modules: ['calendar'] },
    { name: 'planning', href: '/de/planning', icon: 'ClipboardList', modules: ['daily_plans'] },
    { name: 'qualifications', href: '/de/qualifications', icon: 'Award', modules: ['qualifications'] },
    { name: 'settings', href: '/de/settings', icon: 'Settings', modules: ['settings'] },
  ];

  // ADMIN sieht alles
  if (await isAdmin(roleId)) return allNav;

  const allowed = await Promise.all(
    allNav.map(async (item) => {
      if (item.modules.length === 0) return { item, allowed: true };
      const results = await Promise.all(
        item.modules.map((mod) => canRead(roleId, mod, 'view'))
      );
      return { item, allowed: results.some((r) => r.allowed) };
    })
  );

  return allowed.filter((a) => a.allowed).map((a) => a.item);
}