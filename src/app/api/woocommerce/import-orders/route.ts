import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { importWooCommerceOrders } from '@/lib/woocommerce-import';
import { z } from 'zod';

const importSchema = z.object({
  status: z.string().optional(), // 'completed,processing'
  after: z.string().optional(), // ISO8601 date
  before: z.string().optional(), // ISO8601 date
});

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { status, after, before } = importSchema.parse(body);

    // Import durchführen
    const result = await importWooCommerceOrders({
      status,
      after,
      before,
      importUserId: session.user.id,
    });

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      message: `Import abgeschlossen: ${result.imported} Bestellungen importiert, ${result.skipped} übersprungen, ${result.errors.length} Fehler`,
    });
  } catch (error) {
    console.error('Error importing WooCommerce orders:', error);
    return NextResponse.json(
      {
        error: 'Import failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
