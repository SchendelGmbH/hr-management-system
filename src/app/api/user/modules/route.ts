import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/user/modules - Modul-Berechtigungen des aktuellen Benutzers abrufen
export async function GET() {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's roleId
    const userResult = await pool.query(
      `SELECT "roleId" FROM users WHERE id = $1`,
      [session.user.id]
    );

    const roleId = userResult.rows[0]?.roleId;

    if (!roleId) {
      return NextResponse.json({ permissions: [] });
    }

    // Get module permissions for this role
    const result = await pool.query(
      `SELECT 
        sm.id as "moduleId",
        sm.key as "moduleKey",
        sm.name as "moduleName",
        COALESCE(rp."canAccess", false) as "canAccess"
       FROM system_modules sm
       LEFT JOIN role_permissions rp ON rp."moduleId" = sm.id AND rp."roleId" = $1
       WHERE sm."isActive" = true
       ORDER BY sm."order" ASC`,
      [roleId]
    );

    return NextResponse.json({ permissions: result.rows });
  } catch (error) {
    console.error('[API] Error fetching user modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch module permissions' },
      { status: 500 }
    );
  }
}
