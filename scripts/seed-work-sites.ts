/**
 * Einmaliger Script zum Anlegen der Standard-Baustellen.
 * Ausführen: npx tsx scripts/seed-work-sites.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITES = [
  { name: 'Baustelle 1',  location: 'Kleve',        defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 2',  location: 'Krefeld',       defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 3',  location: 'BK',            defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 4',  location: 'MH',            defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 5',  location: 'Hüttenstraße',  defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 6',  location: 'Langenfeld',    defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 7',  location: 'Köln',          defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 8',  location: 'Moers',         defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 9',  location: 'Lager',         defaultStartTime: '06:00', defaultEndTime: '16:00' },
  { name: 'Baustelle 10', location: 'Meerbusch',     defaultStartTime: '06:00', defaultEndTime: '16:00' },
] as const;

async function main() {
  let created = 0;
  let updated = 0;

  for (const site of SITES) {
    const existing = await prisma.workSite.findFirst({
      where: { name: site.name, location: site.location },
    });

    if (existing) {
      await prisma.workSite.update({
        where: { id: existing.id },
        data: { lastUsedAt: new Date() },
      });
      console.log(`  ↺ Updated  | ${site.name.padEnd(12)} | ${site.location}`);
      updated++;
    } else {
      await prisma.workSite.create({
        data: {
          name: site.name,
          location: site.location,
          defaultStartTime: site.defaultStartTime,
          defaultEndTime: site.defaultEndTime,
          lastUsedAt: new Date(),
        },
      });
      console.log(`  ✓ Created  | ${site.name.padEnd(12)} | ${site.location}`);
      created++;
    }
  }

  console.log(`\nDone: ${created} created, ${updated} already existed (lastUsedAt refreshed).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
