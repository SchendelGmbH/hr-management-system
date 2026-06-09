import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { importWooCommerceProducts } from '@/lib/woocommerce-products-import';
import { z } from 'zod';
import crypto from 'crypto';

const importSchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  // Validate WooCommerce webhook signature
  const signature = request.headers.get('x-wc-webhook-signature');
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  if (signature && secret) {
    const rawBody = await request.text();
    const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    if (signature !== `sha256=${expectedSig}`) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
    // Re-parse JSON after reading raw body
    try {
      const body = JSON.parse(rawBody);
      (request as NextRequest & { bodyJson?: unknown }).bodyJson = body;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  try {
    const body = (request as NextRequest & { bodyJson?: unknown }).bodyJson || await request.json();
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
