import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { extractCustomVariables } from '@/lib/templateVariables';

export const dynamic = 'force-dynamic';

// GET /api/templates/[id] – Template + Custom-Variablen abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'documents', 'templates');
  if (authResult.error) return authResult.error;

  const { id } = await params;

  try {
    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 });
    }
    const customVariables = extractCustomVariables(template.content);
    return NextResponse.json({ template, customVariables });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/templates/[id] – Template aktualisieren
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'documents', 'templates');
  if (authResult.error) return authResult.error;

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requirePermission(request, 'documents', 'templates');
  if (authResult.error) return authResult.error;
  const { session } = authResult;

  const { id } = await params;

  try {
    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 });
    }

    await prisma.documentTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
