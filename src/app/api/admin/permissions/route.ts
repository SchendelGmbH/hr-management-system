import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireAdmin } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/admin/permissions - Alle Berechtigungen abrufen
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const result = await pool.query(
      `SELECT p.id, p.key, p.name, p.description, p."moduleId", sm.key as "moduleKey", sm.name as "moduleName"
       FROM permissions p
       JOIN system_modules sm ON p."moduleId" = sm.id
       WHERE sm."isActive" = true
       ORDER BY sm.name, p.name`
    );

    return NextResponse.json({ permissions: result.rows });
  } catch (error) {
    console.error('[API] Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

// POST /api/admin/permissions - Neue Berechtigung erstellen
export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { moduleId, key, name, description } = await request.json();

    if (!moduleId || !key || !name) {
      return NextResponse.json(
        { error: 'Module ID, key and name are required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO permissions (id, "moduleId", key, name, description)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING *`,
      [moduleId, key, name, description || null]
    );

    return NextResponse.json({ permission: result.rows[0] });
  } catch (error: any) {
    console.error('[API] Error creating permission:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Permission key already exists for this module' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create permission' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/permissions/:id - Berechtigung aktualisieren
export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { id, name, description } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Permission ID is required' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    await pool.query(
      `UPDATE permissions SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error updating permission:', error);
    return NextResponse.json(
      { error: 'Failed to update permission' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/permissions/:id - Berechtigung löschen
export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Permission ID is required' },
        { status: 400 }
      );
    }

    await pool.query('DELETE FROM permissions WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting permission:', error);
    return NextResponse.json(
      { error: 'Failed to delete permission' },
      { status: 500 }
    );
  }
}
