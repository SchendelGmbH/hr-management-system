/**
 * Reindex-Skript: Extrahiert Text aus bestehenden Dokumenten und speichert ihn in textContent.
 * Verarbeitet nur Version-Dokumente (isContainer=false) mit filePath und textContent=null.
 *
 * Ausführen: npx ts-node --skip-project prisma/reindex-documents.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fieldEncryptionExtension } from 'prisma-field-encryption';

const baseClient = new PrismaClient();
const prisma = baseClient.$extends(fieldEncryptionExtension());

async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');
      const buffer = await readFile(filePath);
      const data = await pdfParse(buffer);
      const text = (data.text as string | undefined)?.trim() ?? '';
      return text.slice(0, 10_000) || null;
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const text = (result.value as string | undefined)?.trim() ?? '';
      return text.slice(0, 10_000) || null;
    }
    return null;
  } catch (err) {
    console.error('  Fehler bei Textextraktion:', err);
    return null;
  }
}

async function main() {
  console.log('=== Dokument-Reindex gestartet ===\n');

  const versions = await (prisma as any).document.findMany({
    where: {
      isContainer: false,
      filePath: { not: null },
      textContent: null,
      mimeType: {
        in: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
      },
    },
    select: { id: true, filePath: true, mimeType: true, title: true },
  });

  console.log(`Zu verarbeitende Dokumente: ${versions.length}\n`);

  let updated = 0;
  let skipped = 0;

  for (const doc of versions) {
    const absPath = join(process.cwd(), 'public', doc.filePath as string);
    process.stdout.write(`  [${doc.id.slice(-6)}] ${(doc.title as string)?.slice(0, 40)} … `);

    const text = await extractText(absPath, doc.mimeType as string);

    if (text) {
      await (prisma as any).document.update({
        where: { id: doc.id },
        data: { textContent: text },
      });
      console.log(`✓ ${text.length} Zeichen`);
      updated++;
    } else {
      console.log('– kein Text (Bild-PDF oder leer)');
      skipped++;
    }
  }

  console.log(`\n=== Fertig: ${updated} aktualisiert, ${skipped} übersprungen ===`);
}

main()
  .catch(console.error)
  .finally(() => baseClient.$disconnect());
