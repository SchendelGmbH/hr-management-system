import { readFile } from 'fs/promises';

/**
 * Extrahiert Text aus einer Datei für die Volltextsuche.
 * Gibt null zurück wenn der Dateityp nicht unterstützt wird oder die Extraktion fehlschlägt.
 * Maximale Länge: 10.000 Zeichen (um DB-Overhead zu begrenzen).
 */
export async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'application/pdf') {
      // pdf-parse@1.1.1 — use internal module path to avoid Next.js ENOENT test-file issue
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

    // JPG, PNG und andere Binärformate → nicht durchsuchbar
    return null;
  } catch (err) {
    // Textextraktion ist optional — ein Fehler darf den Upload nicht blockieren
    console.error('[extractText] Fehler bei der Textextraktion:', err);
    return null;
  }
}
