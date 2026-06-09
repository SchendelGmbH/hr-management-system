import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requireAdmin, requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { checkLoginRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function generateTempPassword(): string {
  return 'Tmp-' + crypto.randomBytes(8).toString('hex');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'employees', 'password');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  // Rate-Limit nach Admin-Benutzer-ID (verhindert Brute-Force gegen festes Ziel)
  if (!(await checkLoginRateLimit(session.user.id))) {
    return NextResponse.json(
      { error: 'Zu viele Versuche. Bitte warten Sie.' },
      { status: 429 }
    );
  }

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
      userId: session.user.id,
      action: 'RESET_PASSWORD',
      entityType: 'Employee',
      entityId: id,
    },
  });

  // TODO: E-Mail-Versand hier ergänzen, sobald E-Mail-System integriert ist
  // await sendPasswordResetEmail({ to: user.email, tempPassword });

  return NextResponse.json({
    success: true,
    message: 'Neues Passwort wurde gesetzt. Bitte teilen Sie es dem Mitarbeiter mit.',
  });
}
