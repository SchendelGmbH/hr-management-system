import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/user/permissions - Berechtigungen des aktuellen Benutzers abrufen
export async function GET() {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user has ADMIN role
    if (session.user.role === 'ADMIN') {
      // Admin gets all permissions
      const result = await pool.query(
        `SELECT id, key, name, true as granted
         FROM permissions`
      );
      
      // Add admin full access
      return NextResponse.json({ 
        permissions: [
          ...result.rows,
          { id: 'admin', key: 'admin.full_access', name: 'Admin Full Access', granted: true }
        ] 
      });
    }

    // Get user's roleId from session
    const roleId = session.user.roleId;

    if (!roleId) {
      return NextResponse.json({ permissions: [] });
    }

    // Get permissions for this role
    const result = await pool.query(
      `SELECT 
        p.id, p.key, p.name, COALESCE(rmp.granted, false) as granted
       FROM permissions p
       JOIN system_modules sm ON p."moduleId" = sm.id
       JOIN role_permissions rp ON rp."moduleId" = sm.id AND rp."roleId" = $1
       LEFT JOIN role_module_permissions rmp ON rmp."permissionId" = p.id AND rmp."rolePermissionId" = rp.id
       WHERE sm."isActive" = true AND rp."canAccess" = true
       ORDER BY p.name`,
      [roleId]
    );

    return NextResponse.json({ permissions: result.rows });
  } catch (error) {
    console.error('[API] Error fetching user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
