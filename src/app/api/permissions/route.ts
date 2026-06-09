'use server';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const permissions = await prisma.rolePermission.findMany({
      orderBy: [{ role: 'asc' }, { module: 'asc' }, { action: 'asc' }],
    });
    return NextResponse.json(permissions);
  } catch (error) {
    console.error('[permissions GET]', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { role, module, action, access } = body;

    if (!role || !module || !action || !access) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!['none', 'read', 'write'].includes(access)) {
      return NextResponse.json({ error: 'Invalid access level' }, { status: 400 });
    }

    const permission = await prisma.rolePermission.upsert({
      where: { role_module_action: { role, module, action } },
      create: { role, module, action, access },
      update: { access },
    });

    return NextResponse.json(permission);
  } catch (error) {
    console.error('[permissions PUT]', error);
    return NextResponse.json({ error: 'Failed to update permission' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Migration: convert 'all' to 'write'
    if (body.action === 'migrate') {
      const result = await prisma.rolePermission.updateMany({
        where: { access: 'all' },
        data: { access: 'write' },
      });
      return NextResponse.json({ migrated: result.count });
    }

    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
    }

    const results = await Promise.all(
      items.map((item: { role: string; module: string; action: string; access: string }) =>
        prisma.rolePermission.upsert({
          where: { role_module_action: { role: item.role, module: item.module, action: item.action } },
          create: { role: item.role, module: item.module, action: item.action, access: item.access },
          update: { access: item.access },
        })
      )
    );

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error('[permissions POST]', error);
    return NextResponse.json({ error: 'Failed to bulk update' }, { status: 500 });
  }
}