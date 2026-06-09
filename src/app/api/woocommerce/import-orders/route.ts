import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { importWooCommerceOrders } from '@/lib/woocommerce-import';
import { z } from 'zod';
import crypto from 'crypto';

const importSchema = z.object({
  status: z.string().optional(), // 'completed,processing'
  after: z.string().optional(), // ISO8601 date
  before: z.string().optional(), // ISO8601 date
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
