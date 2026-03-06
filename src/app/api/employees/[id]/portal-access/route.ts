import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth, requireAdmin } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = 'Tmp-';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function sanitizeUser(user: { id: string; username: string; email: string | null; role: string; isActive: boolean; lastLogin: Date | null; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

// GET — return linked user for employee (no passwordHash)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
  }

  return NextResponse.json({ user: employee.user ?? null });
}

// POST — create portal access and link to employee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!employee) {
    return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
  }
  if (employee.userId) {
    return NextResponse.json({ error: 'Mitarbeiter hat bereits einen Portalzugang' }, { status: 409 });
  }

  const body = await request.json();
  const { username, email, role = 'USER' } = body as { username: string; email?: string; role?: string };

  if (!username?.trim()) {
    return NextResponse.json({ error: 'Benutzername erforderlich' }, { status: 400 });
  }

  // Check username uniqueness
  const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (existing) {
    return NextResponse.json({ error: 'Benutzername bereits vergeben' }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      username: username.trim(),
      email: email?.trim() || null,
      passwordHash,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
    },
    select: { id: true, username: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true },
  });

  await prisma.employee.update({ where: { id }, data: { userId: user.id } });

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'CREATE_PORTAL_ACCESS',
      entityType: 'Employee',
      entityId: id,
      newValues: { username: user.username, role: user.role },
    },
  });

  return NextResponse.json({ user: sanitizeUser(user), tempPassword }, { status: 201 });
}

// PUT — update username / email / role / isActive
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({ where: { id }, select: { userId: true } });
  if (!employee?.userId) {
    return NextResponse.json({ error: 'Kein Portalzugang vorhanden' }, { status: 404 });
  }

  const body = await request.json();
  const { username, email, role, isActive } = body as {
    username?: string;
    email?: string;
    role?: string;
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

  const updated = await prisma.user.update({
    where: { id: employee.userId },
    data: {
      ...(username !== undefined && { username: username.trim() }),
      ...(email !== undefined && { email: email.trim() || null }),
      ...(role !== undefined && { role: role === 'ADMIN' ? 'ADMIN' : 'USER' }),
      ...(isActive !== undefined && { isActive }),
    },
    select: { id: true, username: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'UPDATE_PORTAL_ACCESS',
      entityType: 'Employee',
      entityId: id,
      newValues: { username: updated.username, role: updated.role, isActive: updated.isActive },
    },
  });

  return NextResponse.json({ user: sanitizeUser(updated) });
}

// DELETE — revoke portal access (unlink + delete user)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

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
      userId: session!.user.id,
      action: 'REVOKE_PORTAL_ACCESS',
      entityType: 'Employee',
      entityId: id,
      oldValues: { username: employee.user?.username },
    },
  });

  return NextResponse.json({ success: true });
}
