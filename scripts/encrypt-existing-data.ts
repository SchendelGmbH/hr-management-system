/**
 * Datenmigrations-Skript: Bestehende Klartextdaten verschlüsseln
 *
 * Dieses Skript liest alle bestehenden Mitarbeiter und Dokumente aus der Datenbank
 * und schreibt die sensiblen Felder zurück – dabei greift die prisma-field-encryption
 * Extension und verschlüsselt die Daten automatisch.
 *
 * Ausführen mit:
 *   npx tsx scripts/encrypt-existing-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new PrismaClient();
const prisma = client.$extends(fieldEncryptionExtension());

async function encryptEmployees() {
  const employees = await prisma.employee.findMany();
  console.log(`Verschlüssele ${employees.length} Mitarbeiter...`);

  let count = 0;
  for (const emp of employees) {
    await prisma.employee.update({
      where: { id: emp.id },
      data: {
        email: emp.email,
        phone: emp.phone,
        socialSecurityNumber: emp.socialSecurityNumber,
        taxId: emp.taxId,
        healthInsurance: emp.healthInsurance,
        street: emp.street,
        zipCode: emp.zipCode,
        city: emp.city,
        payGrade: emp.payGrade,
        keyNumber: emp.keyNumber,
        chipNumber: emp.chipNumber,
      },
    });
    count++;
    if (count % 10 === 0) {
      console.log(`  ${count}/${employees.length} Mitarbeiter verarbeitet...`);
    }
  }
  console.log(`✓ ${employees.length} Mitarbeiter verschlüsselt`);
}

async function encryptDocuments() {
  const documents = await prisma.document.findMany();
  console.log(`Verschlüssele ${documents.length} Dokumente...`);

  let count = 0;
  for (const doc of documents) {
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        title: doc.title,
        description: doc.description,
        notes: doc.notes,
      },
    });
    count++;
    if (count % 10 === 0) {
      console.log(`  ${count}/${documents.length} Dokumente verarbeitet...`);
    }
  }
  console.log(`✓ ${documents.length} Dokumente verschlüsselt`);
}

async function main() {
  console.log('=== Datenverschlüsselung gestartet ===\n');

  try {
    await encryptEmployees();
    await encryptDocuments();
    console.log('\n=== Migration abgeschlossen ===');
  } catch (error) {
    console.error('Fehler bei der Migration:', error);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
}

main();
