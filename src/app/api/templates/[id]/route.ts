import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';

// PUT /api/templates/[id] – Template aktualisieren
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, description, content } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }

    const template = await prisma.documentTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        content,
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/templates/[id] – Template löschen
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

    // Briefpapier-Datei löschen falls vorhanden
    if (template.letterheadPath) {
      try {
        await unlink(join(process.cwd(), 'public', template.letterheadPath));
      } catch {
        // Datei evtl. schon gelöscht — ignorieren
      }
    }

    await prisma.documentTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
