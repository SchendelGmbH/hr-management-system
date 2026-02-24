import { PrismaClient } from '@prisma/client';
import { CATEGORY_COLORS } from '../src/lib/categoryColors';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`${categories.length} Kategorien gefunden.`);

  for (let i = 0; i < categories.length; i++) {
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    await prisma.category.update({
      where: { id: categories[i].id },
      data: { color },
    });
    console.log(`  ${categories[i].name} → ${color}`);
  }

  console.log('Fertig.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
