/**
 * Einmaliger Script zum Anlegen der Standard-Qualifikationstypen.
 * Ausführen: npx tsx scripts/seed-qualification-types.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TYPES = [
  // Unterweisungen – jährlich (12 Monate)
  { name: 'Brandschutzunterweisung',   group: 'INSTRUCTION', recurringIntervalMonths: 12 },
  { name: 'Arbeitssicherheit',          group: 'INSTRUCTION', recurringIntervalMonths: 12 },
  { name: 'Elektrosicherheit',          group: 'INSTRUCTION', recurringIntervalMonths: 12 },
  { name: 'Ersthelfer-Auffrischung',    group: 'INSTRUCTION', recurringIntervalMonths: 12 },

  // Zertifikate & Lizenzen – einmalig (null)
  { name: 'Führerschein Klasse B',      group: 'CERTIFICATE', recurringIntervalMonths: null },
  { name: 'Staplerschein',              group: 'CERTIFICATE', recurringIntervalMonths: null },
  { name: 'Schweißschein',              group: 'CERTIFICATE', recurringIntervalMonths: null },
  { name: 'Kranführerschein',           group: 'CERTIFICATE', recurringIntervalMonths: null },
  { name: 'Ersthelfer-Grundkurs',       group: 'CERTIFICATE', recurringIntervalMonths: null },

  // Fortbildungen – einmalig (null)
  { name: 'Interne Schulung',           group: 'TRAINING', recurringIntervalMonths: null },
  { name: 'Externe Schulung',           group: 'TRAINING', recurringIntervalMonths: null },
  { name: 'Online-Kurs',                group: 'TRAINING', recurringIntervalMonths: null },
  { name: 'Seminar',                    group: 'TRAINING', recurringIntervalMonths: null },
] as const;

async function main() {
  let created = 0;
  let skipped = 0;

  for (const t of TYPES) {
    const existing = await prisma.qualificationType.findFirst({
      where: { name: t.name, group: t.group },
    });
    if (existing) {
      console.log(`  ⊘ Exists  | ${t.group.padEnd(11)} | ${t.name}`);
      skipped++;
      continue;
    }
    await prisma.qualificationType.create({
      data: {
        name: t.name,
        group: t.group,
        recurringIntervalMonths: t.recurringIntervalMonths,
        isActive: true,
      },
    });
    console.log(`  ✓ Created | ${t.group.padEnd(11)} | ${t.name}`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
