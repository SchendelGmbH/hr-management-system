import { getWooCommerceClient, WCOrder, WCLineItem } from './woocommerce';
import prisma from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ orderId: number; error: string }>;
}

interface ImportOptions {
  status?: string; // z.B. 'completed,processing'
  after?: string; // ISO8601 date
  before?: string; // ISO8601 date
  importUserId: string; // User ID für createdBy
}

export async function importWooCommerceOrders(
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const wcClient = getWooCommerceClient();

    // Alle Bestellungen abrufen (mit Pagination)
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { orders, totalPages } = await wcClient.getOrders({
        status: options.status,
        after: options.after,
        before: options.before,
        page,
        per_page: 100,
      });

      for (const wcOrder of orders) {
        try {
          await importSingleOrder(wcOrder, options.importUserId);
          result.imported++;
        } catch (error) {
          result.errors.push({
            orderId: wcOrder.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      page++;
      hasMore = page <= totalPages;
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      orderId: 0,
      error: `Global error: ${error instanceof Error ? error.message : 'Unknown'}`,
    });
  }

  return result;
}

async function importSingleOrder(
  wcOrder: WCOrder,
  importUserId: string
): Promise<void> {
  // 1. Duplikat-Check
  const existing = await prisma.clothingOrder.findUnique({
    where: { woocommerceOrderId: wcOrder.id },
  });

  if (existing) {
    throw new Error(`Order already imported (woocommerceOrderId: ${wcOrder.id})`);
  }

  // 2. Employee-Mapping (via Custom Field oder Email)
  const employee = await findEmployeeForOrder(wcOrder);
  if (!employee) {
    throw new Error(
      `No employee found for WooCommerce customer ${wcOrder.customer_id} / ${wcOrder.billing.email}`
    );
  }

  // 3. Line Items verarbeiten
  const items = await Promise.all(
    wcOrder.line_items.map((lineItem) => processLineItem(lineItem))
  );

  // Filter out null items (SKU not found)
  const validItems = items.filter((item) => item !== null) as Array<{
    clothingItemId: string;
    size: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;

  if (validItems.length === 0) {
    throw new Error('No valid line items found (SKUs not matching)');
  }

  // 4. Status-Mapping
  const hrStatus = mapWooCommerceStatus(wcOrder.status);
  if (!hrStatus) {
    throw new Error(`Order status '${wcOrder.status}' should not be imported`);
  }

  // 5. Bestellung in HR-System erstellen
  const totalAmount = new Decimal(wcOrder.total);

  const order = await prisma.clothingOrder.create({
    data: {
      employeeId: employee.id,
      orderDate: new Date(wcOrder.date_created),
      totalAmount,
      status: hrStatus,
      notes: wcOrder.customer_note || `Imported from WooCommerce (Order #${wcOrder.number})`,
      createdBy: importUserId,
      woocommerceOrderId: wcOrder.id,
      importedFromWC: true,
      lastSyncedAt: new Date(),
      deliveredAt: hrStatus === 'DELIVERED' ? new Date() : null,
      items: {
        create: validItems.map((item) => ({
          clothingItemId: item.clothingItemId,
          size: item.size,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
    },
    include: {
      employee: true,
      items: {
        include: {
          clothingItem: true,
        },
      },
    },
  });

  // 6. Budget abziehen wenn Status DELIVERED
  if (hrStatus === 'DELIVERED') {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        remainingBudget: {
          decrement: totalAmount,
        },
      },
    });
  }

  // 7. Audit-Log
  await prisma.auditLog.create({
    data: {
      userId: importUserId,
      action: 'CREATE',
      entityType: 'ClothingOrder',
      entityId: order.id,
      newValues: {
        woocommerceOrderId: wcOrder.id,
        importedFromWC: true,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        totalAmount: order.totalAmount.toString(),
        status: hrStatus,
        itemCount: validItems.length,
      },
    },
  });
}

async function findEmployeeForOrder(wcOrder: WCOrder): Promise<any | null> {
  // Strategie 1: Custom Field "woocommerce_customer_id"
  const customFieldDef = await prisma.customFieldDefinition.findUnique({
    where: { fieldName: 'woocommerce_customer_id' },
  });

  if (customFieldDef && wcOrder.customer_id > 0) {
    const customFieldValue = await prisma.customFieldValue.findFirst({
      where: {
        fieldDefinitionId: customFieldDef.id,
        textValue: wcOrder.customer_id.toString(),
      },
      include: {
        employee: true,
      },
    });

    if (customFieldValue) {
      return customFieldValue.employee;
    }
  }

  // Strategie 2: Email-Matching
  if (wcOrder.billing.email) {
    const employee = await prisma.employee.findFirst({
      where: { email: wcOrder.billing.email },
    });

    if (employee) {
      return employee;
    }
  }

  // Nicht gefunden
  return null;
}

async function processLineItem(
  lineItem: WCLineItem
): Promise<{
  clothingItemId: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
} | null> {
  let clothingItem = null;

  // STRATEGIE 1: Direkt über SKU (wenn vorhanden)
  if (lineItem.sku) {
    clothingItem = await prisma.clothingItem.findUnique({
      where: { sku: lineItem.sku },
    });

    if (clothingItem) {
      console.log(`✓ Line item ${lineItem.id}: Found via SKU '${lineItem.sku}'`);
    }
  }

  // STRATEGIE 2: Fallback über product_id → woocommerceId
  if (!clothingItem && lineItem.product_id) {
    console.log(`Line item ${lineItem.id}: No SKU or not found, trying via product_id ${lineItem.product_id}`);

    clothingItem = await prisma.clothingItem.findUnique({
      where: { woocommerceId: lineItem.product_id },
    });

    if (clothingItem) {
      console.log(`✓ Line item ${lineItem.id}: Found via woocommerceId ${lineItem.product_id}`);
    }
  }

  // STRATEGIE 3: Fallback über WooCommerce API (SKU vom Produkt holen)
  if (!clothingItem && lineItem.product_id) {
    console.log(`Line item ${lineItem.id}: Trying WooCommerce API to get product SKU...`);

    try {
      const wcClient = getWooCommerceClient();
      const wcProduct = await wcClient.getProduct(lineItem.product_id);

      if (wcProduct && wcProduct.sku) {
        console.log(`Line item ${lineItem.id}: Got SKU '${wcProduct.sku}' from WooCommerce API`);

        clothingItem = await prisma.clothingItem.findUnique({
          where: { sku: wcProduct.sku },
        });

        if (clothingItem) {
          console.log(`✓ Line item ${lineItem.id}: Found via WC API SKU '${wcProduct.sku}'`);
        }
      }
    } catch (error) {
      console.error(`Error fetching product ${lineItem.product_id} from WooCommerce API:`, error);
    }
  }

  // Kein ClothingItem gefunden
  if (!clothingItem) {
    console.warn(
      `✗ Line item ${lineItem.id}: No ClothingItem found (SKU: ${lineItem.sku || 'none'}, product_id: ${lineItem.product_id || 'none'})`
    );
    return null;
  }

  // 2. Größe aus meta_data extrahieren
  const sizeMetaKeys = ['pa_size', 'Size', 'Größe', 'size', '_pa_size'];
  let size = '';

  for (const meta of lineItem.meta_data) {
    if (sizeMetaKeys.includes(meta.key)) {
      size = meta.display_value || meta.value;
      break;
    }
  }

  // FALLBACK: Größe aus Variation laden (für variable Produkte)
  if (!size && lineItem.variation_id && lineItem.product_id) {
    console.log(`Line item ${lineItem.id}: No size in meta_data, trying variation ${lineItem.variation_id}...`);

    try {
      const wcClient = getWooCommerceClient();
      const variation = await wcClient.getProductVariation(lineItem.product_id, lineItem.variation_id);

      // Suche nach Größen-Attribut in der Variation
      const sizeAttr = variation.attributes.find(
        (attr: any) =>
          attr.name.toLowerCase() === 'size' ||
          attr.name.toLowerCase() === 'größe' ||
          attr.name.toLowerCase() === 'groesse' ||
          attr.name === 'pa_size'
      );

      if (sizeAttr && sizeAttr.option) {
        size = sizeAttr.option;
        console.log(`✓ Line item ${lineItem.id}: Found size '${size}' from variation`);
      }
    } catch (error) {
      console.error(`Error fetching variation ${lineItem.variation_id} for product ${lineItem.product_id}:`, error);
    }
  }

  if (!size) {
    console.warn(`✗ Line item ${lineItem.id}: No size found (tried meta_data and variation), skipping`);
    return null;
  }

  // 3. Größe validieren gegen availableSizes
  const availableSizes = clothingItem.availableSizes as string[];
  if (!availableSizes.includes(size)) {
    console.warn(
      `Size '${size}' not available for item '${clothingItem.name}' (available: ${availableSizes.join(', ')}), skipping`
    );
    return null;
  }

  // 4. Preise konvertieren
  const unitPrice = new Decimal(lineItem.price);
  const totalPrice = new Decimal(lineItem.total);

  return {
    clothingItemId: clothingItem.id,
    size,
    quantity: lineItem.quantity,
    unitPrice: unitPrice.toNumber(),
    totalPrice: totalPrice.toNumber(),
  };
}

function mapWooCommerceStatus(
  wcStatus: string
): 'ORDERED' | 'DELIVERED' | 'RETURNED' | null {
  switch (wcStatus) {
    case 'pending':
    case 'processing':
    case 'on-hold':
      return 'ORDERED';
    case 'completed':
      return 'DELIVERED';
    case 'refunded':
      return 'RETURNED';
    case 'cancelled':
    case 'failed':
      return null; // Nicht importieren
    default:
      return null;
  }
}
