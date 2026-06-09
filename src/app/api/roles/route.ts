'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ADMIN_ROLE_NAME = 'ADMIN';

/** GET /api/roles — list all roles */
export async function GET() {
  const session = await auth();
  if (!session || session.user.roleName !== ADMIN_ROLE_NAME) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const roles = await prisma.role.findMany({
    orderBy: [{ name: 'asc' }],
    include: {
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(roles);
}

/** POST /api/roles — create a new role */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.roleName !== ADMIN_ROLE_NAME) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name erforderlich' }, { status: 400 });
  }

  // Uppercase internal name
  const internalName = name.trim().toUpperCase().replace(/\s+/g, '_');

  // Check uniqueness
  const existing = await prisma.role.findUnique({ where: { name: internalName } });
  if (existing) {
    return NextResponse.json({ error: 'Rolle bereits vorhanden' }, { status: 409 });
  }

  const role = await prisma.role.create({
    data: { name: internalName, description: description?.trim() || null },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE_ROLE',
      entityType: 'Role',
      entityId: role.id,
      newValues: { name: role.name },
    },
  });

  return NextResponse.json(role, { status: 201 });
}

/** PUT /api/roles — update a role */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.roleName !== ADMIN_ROLE_NAME) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, description } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 });
  }

  // ADMIN role cannot be renamed
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Rolle nicht gefunden' }, { status: 404 });
  }
  if (existing.name === ADMIN_ROLE_NAME) {
    return NextResponse.json({ error: 'ADMIN-Rolle kann nicht bearbeitet werden' }, { status: 403 });
  }

  const updateData: { name?: string; description?: string | null } = {};
  if (name !== undefined) {
    const internalName = name.trim().toUpperCase().replace(/\s+/g, '_');
    // Check name uniqueness
    const conflict = await prisma.role.findFirst({
      where: { name: internalName, NOT: { id } },
    });
    if (conflict) {
      return NextResponse.json({ error: 'Rollenname bereits vergeben' }, { status: 409 });
    }
    updateData.name = internalName;
  }
  if (description !== undefined) {
    updateData.description = description?.trim() || null;
  }

  const updated = await prisma.role.update({
    where: { id },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE_ROLE',
      entityType: 'Role',
      entityId: id,
      newValues: updateData,
    },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/roles — delete a role */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.roleName !== ADMIN_ROLE_NAME) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) {
    return NextResponse.json({ error: 'Rolle nicht gefunden' }, { status: 404 });
  }

  // ADMIN cannot be deleted
  if (role.name === ADMIN_ROLE_NAME) {
    return NextResponse.json({ error: 'ADMIN-Rolle kann nicht gelöscht werden' }, { status: 403 });
  }

  // Check if any users have this role
  const userCount = await prisma.user.count({ where: { roleId: id } });
  if (userCount > 0) {
    return NextResponse.json(
      { error: `${userCount} Mitarbeiter haben diese Rolle. Bitte zuerst zuweisen.`, userCount },
      { status: 409 }
    );
  }

  // Delete role (Cascade deletes RolePermissions)
  await prisma.role.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETE_ROLE',
      entityType: 'Role',
      entityId: id,
      oldValues: { name: role.name },
    },
  });

  return NextResponse.json({ success: true });
}