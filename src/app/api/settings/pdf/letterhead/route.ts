import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join, resolve, normalize } from 'path';
import { existsSync } from 'fs';

const LETTERHEAD_DIR = join(process.cwd(), 'public', 'uploads', 'letterheads');

/**
 * Validiert einen DB-gespeicherten Pfad gegen ein Whitelist-Pattern
 * um Path-Traversal-Angriffe zu verhindern.
 */
function safeLetterheadPath(storedPath: string): string | null {
  const resolved = resolve(join(process.cwd(), 'public', normalize(storedPath)));
  if (!resolved.startsWith(LETTERHEAD_DIR)) return null;
  return resolved;
}

// POST /api/settings/pdf/letterhead – Globales Briefpapier hochladen
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

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

    // Altes Briefpapier sicher löschen (Path-Traversal-geschützt)
    const existing = await prisma.systemSetting.findUnique({ where: { key: 'letterhead_path' } });
    if (existing?.value) {
      const safePath = safeLetterheadPath(existing.value);
      if (safePath) {
        try { await unlink(safePath); } catch { /* ignorieren */ }
      }
    }

    // Upload-Verzeichnis sicherstellen
    if (!existsSync(LETTERHEAD_DIR)) {
      await mkdir(LETTERHEAD_DIR, { recursive: true });
    }

    // Datei speichern – fixer Name "global-letterhead.{ext}"
    const allowedExts = ['png', 'jpg', 'jpeg'];
    const rawExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const ext = allowedExts.includes(rawExt) ? rawExt : 'png';
    const filename = `global-letterhead.${ext}`;
    const filepath = join(LETTERHEAD_DIR, filename);
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
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const existing = await prisma.systemSetting.findUnique({ where: { key: 'letterhead_path' } });
    if (existing?.value) {
      const safePath = safeLetterheadPath(existing.value);
      if (safePath) {
        try { await unlink(safePath); } catch { /* ignorieren */ }
      }
      await prisma.systemSetting.delete({ where: { key: 'letterhead_path' } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing global letterhead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
