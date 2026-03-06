import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/rbac';
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!employee?.userId) {
    return NextResponse.json({ error: 'Kein Portalzugang vorhanden' }, { status: 404 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id: employee.userId },
    data: { passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'RESET_PASSWORD',
      entityType: 'Employee',
      entityId: id,
    },
  });

  // TODO: E-Mail-Versand hier ergänzen, sobald E-Mail-System integriert ist
  // await sendPasswordResetEmail({ to: user.email, tempPassword });

  return NextResponse.json({ tempPassword });
}
