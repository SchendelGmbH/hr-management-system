import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/templates – alle aktiven Templates abrufen
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const templates = await prisma.documentTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/templates – neues Template erstellen
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, description, content } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Inhalt ist erforderlich' }, { status: 400 });
    }

    const template = await prisma.documentTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        content,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
