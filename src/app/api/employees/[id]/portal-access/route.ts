import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requirePermission, requireEmployeeAccess, isAdminFromSession, ADMIN_ROLE_NAME } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function generateTempPassword(): string {
  return 'Tmp-' + crypto.randomBytes(8).toString('hex');
}

function sanitizeUser(user: { id: string; username: string; email: string | null; roleId: string | null; role: { name: string } | null; isActive: boolean; lastLogin: Date | null; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role?.name ?? null,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

// GET — return linked user for employee (no passwordHash)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'portal');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  // IDOR-Schutz: Non-Admin darf nur eigene Portal-Zugriffs-Daten sehen
  const accessResult = await requireEmployeeAccess(id, session);
  if (!accessResult.allowed) return accessResult.error;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          roleId: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          role: { select: { name: true } },
        },
      },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
  }

  return NextResponse.json({ user: employee.user ? sanitizeUser(employee.user as any) : null });
}

// POST — create portal access and link to employee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'portal');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  // IDOR-Schutz: Non-Admin darf nur eigene Portal-Zugriffs-Daten ändern
  const accessResult = await requireEmployeeAccess(id, session);
  if (!accessResult.allowed) return accessResult.error;

  const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!employee) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
  }
  if (employee.userId) {
    return NextResponse.json({ error: 'Mitarbeiter hat bereits einen Portalzugang' }, { status: 409 });
  }

  const body = await request.json();
  const { username, email, roleId } = body as { username: string; email?: string; roleId?: string };

  if (!username?.trim()) {
    return NextResponse.json({ error: 'Benutzername erforderlich' }, { status: 400 });
  }

  // Check username uniqueness
  const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (existing) {
    return NextResponse.json({ error: 'Benutzername bereits vergeben' }, { status: 409 });
  }

  // Validate roleId — must exist in Role table (unless null for ADMIN)
  if (roleId) {
    const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
    if (!roleExists) {
      return NextResponse.json({ error: 'Ungültige Rolle' }, { status: 400 });
    }
    // ADMIN role cannot be assigned via portal-access (security)
    if (roleExists.name === ADMIN_ROLE_NAME) {
      return NextResponse.json({ error: 'ADMIN-Rolle kann nicht zugewiesen werden' }, { status: 403 });
    }
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      username: username.trim(),
      email: email?.trim() || null,
      passwordHash,
      roleId: roleId ?? null,
    },
    include: { role: { select: { name: true } } },
  });

  await prisma.employee.update({ where: { id }, data: { userId: user.id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE_PORTAL_ACCESS',
      entityType: 'Employee',
      entityId: id,
      newValues: { username: user.username, roleId: user.roleId, roleName: user.role?.name },
    },
  });

  return NextResponse.json({ user: sanitizeUser(user as any), tempPassword }, { status: 201 });
}

// PUT — update username / email / roleId / isActive
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'portal');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  // IDOR-Schutz: Non-Admin darf nur eigene Portal-Zugriffs-Daten ändern
  const accessResult = await requireEmployeeAccess(id, session);
  if (!accessResult.allowed) return accessResult.error;

  const employee = await prisma.employee.findUnique({ where: { id }, select: { userId: true } });
  if (!employee?.userId) {
    return NextResponse.json({ error: 'Kein Portalzugang vorhanden' }, { status: 404 });
  }

  const body = await request.json();
  const { username, email, roleId, isActive } = body as {
    username?: string;
    email?: string;
    roleId?: string | null;
    isActive?: boolean;
  };

  // Check username uniqueness if changing
  if (username) {
    const conflict = await prisma.user.findFirst({
      where: { username: username.trim(), NOT: { id: employee.userId } },
    });
    if (conflict) {
      return NextResponse.json({ error: 'Benutzername bereits vergeben' }, { status: 409 });
    }
  }

  // Validate roleId if provided
  if (roleId !== undefined && roleId !== null) {
    const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
    if (!roleExists) {
      return NextResponse.json({ error: 'Ungültige Rolle' }, { status: 400 });
    }
    if (roleExists.name === ADMIN_ROLE_NAME) {
      return NextResponse.json({ error: 'ADMIN-Rolle kann nicht zugewiesen werden' }, { status: 403 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: employee.userId },
    data: {
      ...(username !== undefined && { username: username.trim() }),
      ...(email !== undefined && { email: email.trim() || null }),
      ...(roleId !== undefined && { roleId }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { role: { select: { name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE_PORTAL_ACCESS',
      entityType: 'Employee',
      entityId: id,
      newValues: { username: updated.username, roleId: updated.roleId, roleName: updated.role?.name, isActive: updated.isActive },
    },
  });

  return NextResponse.json({ user: sanitizeUser(updated as any) });
}

// DELETE — revoke portal access (unlink + delete user)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'portal');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  // IDOR-Schutz: Non-Admin darf nur eigene Portal-Zugriffs-Daten löschen
  const accessResult = await requireEmployeeAccess(id, session);
  if (!accessResult.allowed) return accessResult.error;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (!employee?.userId) {
    return NextResponse.json({ error: 'Kein Portalzugang vorhanden' }, { status: 404 });
  }

  // Unlink first, then delete user
  await prisma.employee.update({ where: { id }, data: { userId: null } });
  await prisma.user.delete({ where: { id: employee.userId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'REVOKE_PORTAL_ACCESS',
      entityType: 'Employee',
      entityId: id,
      oldValues: { username: employee.user?.username },
    },
  });

  return NextResponse.json({ success: true });
}