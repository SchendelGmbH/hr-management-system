import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/modules - Aktive Module für alle Benutzer abrufen
export async function GET() {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(
      'SELECT key, name, description, icon, "order" FROM system_modules WHERE "isActive" = true ORDER BY "order" ASC'
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
