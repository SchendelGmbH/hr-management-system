import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { unlink, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  typeId:    z.string().min(1).optional(),
  issuedAt:  z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  issuer:    z.string().max(200).optional().nullable(),
  certNumber:z.string().max(100).optional().nullable(),
  notes:     z.string().max(2000).optional().nullable(),
});

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png',
];

const MAGIC_BYTES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg':      [0xff, 0xd8, 0xff],
  'image/jpg':       [0xff, 0xd8, 0xff],
  'image/png':       [0x89, 0x50, 0x4e, 0x47],
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const magic = MAGIC_BYTES[mimeType];
  if (!magic) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.qualification.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Qualifikation nicht gefunden' }, { status: 404 });
    }

    const updated = await prisma.qualification.update({
      where: { id },
      data: {
        ...(data.typeId     !== undefined && { typeId:     data.typeId }),
        ...(data.issuedAt   !== undefined && { issuedAt:   data.issuedAt  ? new Date(data.issuedAt)  : null }),
        ...(data.expiresAt  !== undefined && { expiresAt:  data.expiresAt ? new Date(data.expiresAt) : null }),
        ...(data.issuer     !== undefined && { issuer:     data.issuer }),
        ...(data.certNumber !== undefined && { certNumber: data.certNumber }),
        ...(data.notes      !== undefined && { notes:      data.notes }),
      },
      include: { type: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Qualification',
        entityId: id,
        newValues: JSON.stringify(data),
      },
    });

    return NextResponse.json({ qualification: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validierungsfehler', details: err.errors }, { status: 400 });
    }
    console.error('Error updating qualification:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const qualification = await prisma.qualification.findUnique({ where: { id } });
    if (!qualification) {
      return NextResponse.json({ error: 'Qualifikation nicht gefunden' }, { status: 404 });
    }

    // Delete file if exists
    if (qualification.filePath) {
      try {
        await unlink(join(process.cwd(), 'public', qualification.filePath));
      } catch { /* File may not exist */ }
    }

    await prisma.qualification.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Qualification',
        entityId: id,
        oldValues: JSON.stringify({ employeeId: qualification.employeeId }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting qualification:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/qualifications/[id]/attachment is handled in a sub-route
// but we handle it here for simplicity via a POST action check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const qualification = await prisma.qualification.findUnique({ where: { id } });
    if (!qualification) {
      return NextResponse.json({ error: 'Qualifikation nicht gefunden' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Dateityp nicht erlaubt (PDF, JPG, PNG)' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json({ error: 'Ungültiges Dateiformat' }, { status: 400 });
    }

    // Store file
    const now = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'qualifications', String(year), month);
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split('.').pop() ?? 'pdf';
    const filename = `${qualification.employeeId}-${id}-${Date.now()}.${ext}`;
    const relativePath = `/uploads/qualifications/${year}/${month}/${filename}`;

    await writeFile(join(uploadDir, filename), buffer);

    // Delete old file if exists
    if (qualification.filePath) {
      try {
        await unlink(join(process.cwd(), 'public', qualification.filePath));
      } catch { /* ignore */ }
    }

    const updated = await prisma.qualification.update({
      where: { id },
      data: { filePath: relativePath, fileName: file.name },
      include: { type: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Qualification',
        entityId: id,
        newValues: JSON.stringify({ filePath: relativePath }),
      },
    });

    return NextResponse.json({ qualification: updated });
  } catch (err) {
    console.error('Error uploading qualification attachment:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
