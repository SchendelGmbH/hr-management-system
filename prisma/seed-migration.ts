/**
 * Data migration: Convert existing root documents to Container + v1 architecture.
 *
 * Before: rootDoc (parentDocumentId=null) + children (parentDocumentId=rootDoc.id)
 * After:  container (isContainer=true) + v1=rootDoc + children, all under container
 *
 * Run once: npx ts-node --project tsconfig.json prisma/seed-migration.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all existing root documents that are NOT yet containers
  const roots = await prisma.document.findMany({
    where: {
      parentDocumentId: null,
      isContainer: false,
    },
    include: {
      categories: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  });

  console.log(`Found ${roots.length} root document(s) to migrate.`);

  for (const root of roots) {
    // Use the latest version's dates if available, otherwise root's own dates
    const latestVersion = root.versions[0];
    const effectiveExpiration = latestVersion?.expirationDate ?? root.expirationDate;
    const effectiveValidFrom = latestVersion?.validFrom ?? root.validFrom;

    // 1. Create the container
    const container = await prisma.document.create({
      data: {
        employeeId: root.employeeId,
        title: root.title,
        description: root.description,
        filePath: null,
        fileName: null,
        fileSize: null,
        mimeType: null,
        validFrom: effectiveValidFrom,
        expirationDate: effectiveExpiration,
        notes: root.notes,
        uploadedAt: root.uploadedAt,
        uploadedBy: root.uploadedBy,
        isContainer: true,
        versionNumber: 0,
        categories: {
          create: root.categories.map((dc) => ({ categoryId: dc.categoryId })),
        },
      },
    });

    // 2. Move root document to be v1 under the container
    await prisma.document.update({
      where: { id: root.id },
      data: {
        parentDocumentId: container.id,
        isContainer: false,
        // versionNumber stays as-is (should already be 1)
      },
    });

    // 3. Move all existing children (v2, v3...) to the container
    await prisma.document.updateMany({
      where: {
        parentDocumentId: root.id,
        id: { not: root.id },
      },
      data: {
        parentDocumentId: container.id,
      },
    });

    console.log(`  Migrated: "${root.title}" → container ${container.id}, v1 = ${root.id}`);
  }

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
