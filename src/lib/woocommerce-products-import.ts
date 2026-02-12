import { getWooCommerceClient, WCProduct } from './woocommerce';
import prisma from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ productId: number; error: string }>;
}

interface ImportOptions {
  category?: string;
  status?: string;
  importUserId: string;
}

export async function importWooCommerceProducts(
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const wcClient = getWooCommerceClient();

    // Alle Produkte abrufen (mit Pagination)
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { products, totalPages } = await wcClient.getProducts({
        category: options.category,
        status: options.status || 'publish',
        page,
        per_page: 100,
      });

      for (const wcProduct of products) {
        try {
          const action = await importSingleProduct(wcProduct, options.importUserId);
          if (action === 'imported') result.imported++;
          if (action === 'updated') result.updated++;
          if (action === 'skipped') result.skipped++;
        } catch (error) {
          result.errors.push({
            productId: wcProduct.id,
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
      productId: 0,
      error: `Global error: ${error instanceof Error ? error.message : 'Unknown'}`,
    });
  }

  return result;
}

async function importSingleProduct(
  wcProduct: WCProduct,
  importUserId: string
): Promise<'imported' | 'updated' | 'skipped'> {
  // 1. Duplikat-Check via SKU oder woocommerceId
  let existingItem = null;

  if (wcProduct.sku) {
    existingItem = await prisma.clothingItem.findUnique({
      where: { sku: wcProduct.sku },
    });
  }

  if (!existingItem && wcProduct.id) {
    existingItem = await prisma.clothingItem.findUnique({
      where: { woocommerceId: wcProduct.id },
    });
  }

  // 2. Größen extrahieren aus Attributes
  const sizes = extractSizesFromAttributes(wcProduct.attributes);

  if (sizes.length === 0) {
    console.warn(`Product ${wcProduct.id} has no sizes, skipping`);
    throw new Error('No sizes found in product attributes');
  }

  // 3. Kategorie extrahieren (erste Kategorie)
  const category = wcProduct.categories.length > 0
    ? wcProduct.categories[0].name
    : 'Allgemein';

  // 4. Preis konvertieren
  const basePrice = new Decimal(wcProduct.regular_price || wcProduct.price || '0');

  // 5. Daten vorbereiten
  const itemData = {
    name: wcProduct.name,
    description: wcProduct.description || wcProduct.short_description || null,
    category,
    basePrice: basePrice.toNumber(),
    availableSizes: sizes,
    imageUrl: wcProduct.images.length > 0 ? wcProduct.images[0].src : null,
    isActive: wcProduct.status === 'publish',
    sku: wcProduct.sku || null,
    woocommerceId: wcProduct.id,
    syncedToWooCommerce: true,
    lastSyncedAt: new Date(),
  };

  // 6. Create oder Update
  if (existingItem) {
    // Update
    await prisma.clothingItem.update({
      where: { id: existingItem.id },
      data: itemData,
    });

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: importUserId,
        action: 'UPDATE',
        entityType: 'ClothingItem',
        entityId: existingItem.id,
        oldValues: {
          name: existingItem.name,
          basePrice: existingItem.basePrice,
          woocommerceId: existingItem.woocommerceId,
        },
        newValues: {
          name: itemData.name,
          basePrice: itemData.basePrice,
          woocommerceId: itemData.woocommerceId,
          importedFromWC: true,
        },
      },
    });

    return 'updated';
  } else {
    // Create
    const newItem = await prisma.clothingItem.create({
      data: itemData,
    });

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: importUserId,
        action: 'CREATE',
        entityType: 'ClothingItem',
        entityId: newItem.id,
        newValues: {
          name: itemData.name,
          woocommerceId: itemData.woocommerceId,
          sku: itemData.sku,
          importedFromWC: true,
        },
      },
    });

    return 'imported';
  }
}

function extractSizesFromAttributes(attributes: WCProduct['attributes']): string[] {
  // Suche nach Size-Attribut
  const sizeAttr = attributes.find(
    (attr) =>
      attr.name.toLowerCase() === 'size' ||
      attr.name.toLowerCase() === 'größe' ||
      attr.name.toLowerCase() === 'groesse' ||
      attr.slug === 'pa_size'
  );

  if (sizeAttr && sizeAttr.options && sizeAttr.options.length > 0) {
    return sizeAttr.options;
  }

  // Fallback: Leeres Array
  return [];
}
