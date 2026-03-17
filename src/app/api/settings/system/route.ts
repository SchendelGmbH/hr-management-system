import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// GET /api/settings/system - System-Einstellungen abrufen
export async function GET() {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(
      'SELECT key, value FROM system_settings WHERE key LIKE $1',
      ['shiftSwap.%']
    );

    const settings: Record<string, string> = {};
    result.rows.forEach((row) => {
      settings[row.key] = row.value;
    });

    // Default-Werte falls nicht gesetzt
    const shiftSwapMode = settings['shiftSwap.mode'] || 'allowed'; // allowed, approval_required, forbidden

    return NextResponse.json({
      shiftSwap: {
        mode: shiftSwapMode,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching system settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/settings/system - System-Einstellungen aktualisieren (nur Admin)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Nur Admin darf System-Einstellungen ändern
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden - Admin required' }, { status: 403 });
  }

  try {
    const { shiftSwap } = await request.json();

    if (shiftSwap?.mode) {
      // Valid values: allowed, approval_required, forbidden
      const validModes = ['allowed', 'approval_required', 'forbidden'];
      if (!validModes.includes(shiftSwap.mode)) {
        return NextResponse.json(
          { error: 'Invalid shiftSwap mode' },
          { status: 400 }
        );
      }

      // Upsert the setting
      await pool.query(
        `INSERT INTO system_settings (key, value, "updatedAt") 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, "updatedAt" = NOW()`,
        ['shiftSwap.mode', shiftSwap.mode]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error updating system settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
