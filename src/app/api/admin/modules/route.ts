import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { Pool } from 'pg';

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/admin/modules - Alle Module abrufen
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const result = await pool.query(
      'SELECT id, key, name, description, icon, "isActive", "order", "createdAt", "updatedAt" FROM system_modules ORDER BY "order" ASC'
    );

    return NextResponse.json({ modules: result.rows });
  } catch (error) {
    console.error('[API] Error fetching modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/modules/:id - Modul aktivieren/deaktivieren
export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { id, isActive } = await request.json();

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'UPDATE system_modules SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
      [isActive, id]
    );

    return NextResponse.json({ module: result.rows[0] });
  } catch (error) {
    console.error('[API] Error updating module:', error);
    return NextResponse.json(
      { error: 'Failed to update module' },
      { status: 500 }
    );
  }
}

// POST /api/admin/modules/seed - Standard-Module initialisieren
export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const defaultModules = [
      { key: 'dashboard', name: 'Dashboard', description: 'Hauptübersicht und Statistiken', icon: 'LayoutDashboard', order: 0 },
      { key: 'employees', name: 'Mitarbeiter', description: 'Mitarbeiterverwaltung', icon: 'Users', order: 1 },
      { key: 'documents', name: 'Dokumente', description: 'Dokumentenmanagement', icon: 'FileText', order: 2 },
      { key: 'clothing', name: 'Bekleidung', description: 'Bekleidungsbestellungen und Verwaltung', icon: 'ShoppingCart', order: 3 },
      { key: 'calendar', name: 'Kalender', description: 'Urlaubs- und Terminkalender', icon: 'Calendar', order: 4 },
      { key: 'planning', name: 'Planung', description: 'Tagesplanung und Einsatzplanung', icon: 'ClipboardList', order: 5 },
      { key: 'qualifications', name: 'Qualifikationen', description: 'Qualifikationsmanagement', icon: 'Award', order: 6 },
      { key: 'shiftSwap', name: 'Schichttausch', description: 'Schichttausch-Anfragen', icon: 'ArrowRightLeft', order: 7 },
      { key: 'tasks', name: 'Aufgaben', description: 'Aufgabenmanagement', icon: 'CheckSquare', order: 8 },
      { key: 'chat', name: 'Chat', description: 'Interner Chat und Messaging', icon: 'MessageCircle', order: 9 },
      { key: 'signatures', name: 'Signaturen', description: 'Dokumentensignaturen', icon: 'PenTool', order: 10 },
      { key: 'notifications', name: 'Benachrichtigungen', description: 'Push-Benachrichtigungen', icon: 'Bell', order: 11 },
    ];

    const created = [];
    for (const mod of defaultModules) {
      // Check if exists
      const existing = await pool.query(
        'SELECT id FROM system_modules WHERE key = $1',
        [mod.key]
      );

      if (existing.rows.length === 0) {
        const result = await pool.query(
          `INSERT INTO system_modules (id, key, name, description, icon, "isActive", "order", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW())
           RETURNING *`,
          [mod.key, mod.name, mod.description, mod.icon, mod.order]
        );
        created.push(result.rows[0]);
      }
    }

    return NextResponse.json({ 
      message: `Created ${created.length} modules`,
      created,
    });
  } catch (error) {
    console.error('[API] Error seeding modules:', error);
    return NextResponse.json(
      { error: 'Failed to seed modules' },
      { status: 500 }
    );
  }
}
