import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireAdmin } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/admin/roles - Alle Rollen abrufen
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    // Get all roles with their permissions
    const rolesResult = await pool.query(
      `SELECT r.id, r.name, r.description, r."isSystem", r."isActive", r."createdAt", r."updatedAt",
              COALESCE(
                json_agg(
                  json_build_object(
                    'moduleId', rp."moduleId",
                    'moduleKey', sm.key,
                    'moduleName', sm.name,
                    'canAccess', rp."canAccess"
                  )
                ) FILTER (WHERE rp.id IS NOT NULL),
                '[]'::json
              ) as permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp."roleId"
       LEFT JOIN system_modules sm ON rp."moduleId" = sm.id
       GROUP BY r.id
       ORDER BY r."isSystem" DESC, r.name ASC`
    );

    return NextResponse.json({ roles: rolesResult.rows });
  } catch (error) {
    console.error('[API] Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

// POST /api/admin/roles - Neue Rolle erstellen
export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { name, description, permissions } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Role name is required' },
        { status: 400 }
      );
    }

    // Create role
    const roleResult = await pool.query(
      `INSERT INTO roles (id, name, description, "isSystem", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, false, true, NOW(), NOW())
       RETURNING *`,
      [name, description || null]
    );

    const role = roleResult.rows[0];

    // Create permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      for (const perm of permissions) {
        if (perm.moduleId) {
          await pool.query(
            `INSERT INTO role_permissions (id, "roleId", "moduleId", "canAccess", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
            [role.id, perm.moduleId, perm.canAccess !== false]
          );
        }
      }
    }

    return NextResponse.json({ role });
  } catch (error: any) {
    console.error('[API] Error creating role:', error);
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Role name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/roles/:id - Rolle aktualisieren
export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { id, name, description, isActive, permissions } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Check if role is system role
    const existingRole = await pool.query(
      'SELECT "isSystem" FROM roles WHERE id = $1',
      [id]
    );

    if (existingRole.rows.length === 0) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    const isSystem = existingRole.rows[0].isSystem;

    // Update role
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined && !isSystem) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (isActive !== undefined && !isSystem) {
      updates.push(`"isActive" = $${paramIndex++}`);
      values.push(isActive);
    }
    updates.push(`"updatedAt" = NOW()`);

    if (updates.length > 0) {
      values.push(id);
      await pool.query(
        `UPDATE roles SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Delete existing permissions
      await pool.query(
        'DELETE FROM role_permissions WHERE "roleId" = $1',
        [id]
      );

      // Insert new permissions
      for (const perm of permissions) {
        if (perm.moduleId) {
          await pool.query(
            `INSERT INTO role_permissions (id, "roleId", "moduleId", "canAccess", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
            [id, perm.moduleId, perm.canAccess !== false]
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/roles/:id - Rolle löschen
export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Check if role is system role
    const existingRole = await pool.query(
      'SELECT "isSystem" FROM roles WHERE id = $1',
      [id]
    );

    if (existingRole.rows.length === 0) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      );
    }

    if (existingRole.rows[0].isSystem) {
      return NextResponse.json(
        { error: 'System roles cannot be deleted' },
        { status: 403 }
      );
    }

    // Delete role (cascade will delete permissions)
    await pool.query('DELETE FROM roles WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting role:', error);
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
