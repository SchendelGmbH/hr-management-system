import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// POST /api/settings/pdf/letterhead – Globales Briefpapier hochladen
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    // Altes Briefpapier löschen falls vorhanden
    const existing = await prisma.systemSetting.findUnique({ where: { key: 'letterhead_path' } });
    if (existing?.value) {
      try {
        const oldRel = existing.value.startsWith('/') ? existing.value.slice(1) : existing.value;
        await unlink(join(process.cwd(), 'public', oldRel));
      } catch {
        // ignorieren
      }
    }

    // Upload-Verzeichnis sicherstellen
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'letterheads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Datei speichern – fixer Name "global-letterhead.{ext}"
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `global-letterhead.${ext}`;
    const filepath = join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const letterheadPath = `/uploads/letterheads/${filename}`;

    await prisma.systemSetting.upsert({
      where: { key: 'letterhead_path' },
      create: { key: 'letterhead_path', value: letterheadPath },
      update: { value: letterheadPath },
    });

    return NextResponse.json({ letterheadPath });
  } catch (error) {
    console.error('Error uploading global letterhead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/settings/pdf/letterhead – Globales Briefpapier entfernen
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const existing = await prisma.systemSetting.findUnique({ where: { key: 'letterhead_path' } });
    if (existing?.value) {
      try {
        const rel = existing.value.startsWith('/') ? existing.value.slice(1) : existing.value;
        await unlink(join(process.cwd(), 'public', rel));
      } catch {
        // ignorieren
      }
      await prisma.systemSetting.delete({ where: { key: 'letterhead_path' } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing global letterhead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
