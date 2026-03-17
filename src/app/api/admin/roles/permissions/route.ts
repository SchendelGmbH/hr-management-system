import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { requireAdmin } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/admin/roles/permissions?roleId=xxx - Berechtigungen einer Rolle abrufen
export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Get all permissions with their grant status for this role
    // Use a subquery to get the rolePermissionId for each module
    const result = await pool.query(
      `SELECT 
        p.id, p.key, p.name, p.description,
        sm.id as "moduleId", sm.key as "moduleKey", sm.name as "moduleName",
        COALESCE(
          (SELECT rmp.granted 
           FROM role_permissions rp 
           LEFT JOIN role_module_permissions rmp ON rmp."rolePermissionId" = rp.id AND rmp."permissionId" = p.id
           WHERE rp."roleId" = $1 AND rp."moduleId" = sm.id
          ), 
          false
        ) as granted
       FROM permissions p
       JOIN system_modules sm ON p."moduleId" = sm.id
       WHERE sm."isActive" = true
       ORDER BY sm.name, p.name`,
      [roleId]
    );

    return NextResponse.json({ permissions: result.rows });
  } catch (error) {
    console.error('[API] Error fetching role permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch role permissions' },
      { status: 500 }
    );
  }
}

// POST /api/admin/roles/permissions - Berechtigung zuweisen
export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { roleId, permissionId, granted } = await request.json();

    if (!roleId || !permissionId) {
      return NextResponse.json(
        { error: 'Role ID and Permission ID are required' },
        { status: 400 }
      );
    }

    // Get the moduleId for this permission
    const permResult = await pool.query(
      `SELECT "moduleId" FROM permissions WHERE id = $1`,
      [permissionId]
    );

    if (permResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Permission not found' },
        { status: 404 }
      );
    }

    const moduleId = permResult.rows[0].moduleId;

    // Ensure role_permission entry exists (upsert)
    const rpResult = await pool.query(
      `INSERT INTO role_permissions (id, "roleId", "moduleId", "canAccess", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       ON CONFLICT ("roleId", "moduleId")
       DO UPDATE SET "updatedAt" = NOW()
       RETURNING id`,
      [roleId, moduleId]
    );

    const rolePermissionId = rpResult.rows[0].id;

    // Upsert the module permission
    await pool.query(
      `INSERT INTO role_module_permissions (id, "rolePermissionId", "permissionId", granted)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT ("rolePermissionId", "permissionId")
       DO UPDATE SET granted = $3`,
      [rolePermissionId, permissionId, granted !== false]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error setting role permission:', error);
    return NextResponse.json(
      { error: 'Failed to set role permission' },
      { status: 500 }
    );
  }
}
