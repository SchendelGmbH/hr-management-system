import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const SETTING_KEYS = [
  'letterhead_path',
  'pdf_margin_top',
  'pdf_margin_bottom',
  'pdf_margin_left',
  'pdf_margin_right',
] as const;

// GET /api/settings/pdf – PDF-Einstellungen abrufen
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return NextResponse.json({
      letterheadPath: map['letterhead_path'] ?? null,
      marginTop: Number(map['pdf_margin_top'] ?? '40'),
      marginBottom: Number(map['pdf_margin_bottom'] ?? '20'),
      marginLeft: Number(map['pdf_margin_left'] ?? '25'),
      marginRight: Number(map['pdf_margin_right'] ?? '25'),
    });
  } catch (error) {
    console.error('Error fetching PDF settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/settings/pdf – Ränder speichern
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { marginTop, marginBottom, marginLeft, marginRight } = body;

    const top = Number(marginTop);
    const bottom = Number(marginBottom);
    const left = Number(marginLeft);
    const right = Number(marginRight);

    if (isNaN(top) || top < 0 || top > 200) {
      return NextResponse.json({ error: 'Abstand oben ungültig (0–200 mm)' }, { status: 400 });
    }
    if (isNaN(bottom) || bottom < 0 || bottom > 200) {
      return NextResponse.json({ error: 'Abstand unten ungültig (0–200 mm)' }, { status: 400 });
    }
    if (isNaN(left) || left < 0 || left > 100) {
      return NextResponse.json({ error: 'Abstand links ungültig (0–100 mm)' }, { status: 400 });
    }
    if (isNaN(right) || right < 0 || right > 100) {
      return NextResponse.json({ error: 'Abstand rechts ungültig (0–100 mm)' }, { status: 400 });
    }

    await Promise.all([
      prisma.systemSetting.upsert({
        where: { key: 'pdf_margin_top' },
        create: { key: 'pdf_margin_top', value: String(top) },
        update: { value: String(top) },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'pdf_margin_bottom' },
        create: { key: 'pdf_margin_bottom', value: String(bottom) },
        update: { value: String(bottom) },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'pdf_margin_left' },
        create: { key: 'pdf_margin_left', value: String(left) },
        update: { value: String(left) },
      }),
      prisma.systemSetting.upsert({
        where: { key: 'pdf_margin_right' },
        create: { key: 'pdf_margin_right', value: String(right) },
        update: { value: String(right) },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving PDF settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
