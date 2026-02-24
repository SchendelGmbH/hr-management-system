import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { employeeNumber: 'EMP-00001' },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!emp) {
    console.log('Mitarbeiter EMP-00001 nicht gefunden.');
    return;
  }

  console.log(`Mitarbeiter: ${emp.firstName} ${emp.lastName} (${emp.id})`);

  const docs = await prisma.document.findMany({
    where: { employeeId: emp.id },
    select: { id: true, isContainer: true, versionNumber: true, title: true },
  });

  console.log(`Gefundene Dokumente: ${docs.length}`);
  docs.forEach((d) => console.log(`  - ${d.id} | isContainer=${d.isContainer} | v${d.versionNumber} | ${d.title}`));

  const deleted = await prisma.document.deleteMany({
    where: { employeeId: emp.id },
  });

  console.log(`\nGelöscht: ${deleted.count} Einträge.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
