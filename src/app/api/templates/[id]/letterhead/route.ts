import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// POST /api/templates/[id]/letterhead – Briefpapier hochladen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei gefunden' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Nur PNG und JPG erlaubt' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei zu groß (max. 5 MB)' }, { status: 400 });
    }

    // Sicherstellen dass Template existiert
    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 });
    }

    // Altes Briefpapier löschen
    if (template.letterheadPath) {
      try {
        await unlink(join(process.cwd(), 'public', template.letterheadPath));
      } catch {
        // ignorieren
      }
    }

    // Upload-Verzeichnis erstellen
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'letterheads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Datei speichern
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `letterhead-${id}-${Date.now()}.${ext}`;
    const filepath = join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const letterheadPath = `/uploads/letterheads/${filename}`;

    await prisma.documentTemplate.update({
      where: { id },
      data: { letterheadPath },
    });

    return NextResponse.json({ letterheadPath });
  } catch (error) {
    console.error('Error uploading letterhead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/templates/[id]/letterhead – Briefpapier entfernen
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 });
    }

    if (template.letterheadPath) {
      try {
        await unlink(join(process.cwd(), 'public', template.letterheadPath));
      } catch {
        // ignorieren
      }
    }

    await prisma.documentTemplate.update({
      where: { id },
      data: { letterheadPath: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing letterhead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
