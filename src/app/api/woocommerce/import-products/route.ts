import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { importWooCommerceProducts } from '@/lib/woocommerce-products-import';
import { z } from 'zod';

const importSchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { category, status } = importSchema.parse(body);

    // Import durchführen
    const result = await importWooCommerceProducts({
      category,
      status,
      importUserId: session.user.id,
    });

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      message: `Import abgeschlossen: ${result.imported} neu, ${result.updated} aktualisiert, ${result.skipped} übersprungen, ${result.errors.length} Fehler`,
    });
  } catch (error) {
    console.error('Error importing WooCommerce products:', error);
    return NextResponse.json(
      {
        error: 'Import failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
