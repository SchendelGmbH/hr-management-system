/**
 * Server-seitige PDF-Generierung aus TipTap-HTML-Templates.
 * Verwendet Puppeteer (Chromium) für exaktes 1:1-Rendering des Editor-HTML.
 * Nur in API-Routes verwenden – nicht im Client.
 */
import puppeteer from 'puppeteer';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { substituteVariables } from './templateVariables';

/**
 * Liest das Briefpapier-Bild und wandelt es in eine Base64-Data-URL um,
 * damit Puppeteer keine externen Dateizugriffe benötigt.
 */
async function getLetterheadDataUrl(letterheadPath: string): Promise<string | null> {
  try {
    const rel = letterheadPath.startsWith('/') ? letterheadPath.slice(1) : letterheadPath;
    const absPath = join(process.cwd(), 'public', rel);
    const buffer = await readFile(absPath);
    const ext = rel.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function generateTemplatePdf(
  htmlContent: string,
  variables: Record<string, string>,
  letterheadPath: string | null
): Promise<Buffer> {
  const substituted = substituteVariables(htmlContent, variables);

  const letterheadDataUrl = letterheadPath
    ? await getLetterheadDataUrl(letterheadPath)
    : null;

  const letterheadHtml = letterheadDataUrl
    ? `<img class="letterhead" src="${letterheadDataUrl}" alt="">`
    : '';

  // Vollständiges HTML-Dokument – TipTap-Formatierungen (bold, italic, headings,
  // Ausrichtung, Schriftgrößen) werden 1:1 vom Browser gerendert.
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 0;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 210mm;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
  }

  /* Briefpapier: position fixed → erscheint auf jeder Seite */
  .letterhead {
    position: fixed;
    top: 0;
    left: 0;
    width: 210mm;
    height: 297mm;
    z-index: -1;
    display: block;
  }

  /* Inhaltsbereich: DIN 5008 Ränder */
  .content {
    margin-top: 113pt;
    margin-left: 70pt;
    margin-right: 70pt;
    margin-bottom: 57pt;
  }

  /* TipTap-Standard-HTML-Elemente */
  p {
    margin: 0 0 8pt 0;
    min-height: 1.5em;
  }
  h1 { font-size: 18pt; font-weight: bold; margin: 6pt 0 10pt 0; }
  h2 { font-size: 16pt; font-weight: bold; margin: 5pt 0 8pt 0; }
  h3 { font-size: 14pt; font-weight: bold; margin: 4pt 0 6pt 0; }
  ul, ol { padding-left: 20pt; margin-bottom: 8pt; }
  li { margin-bottom: 4pt; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  s { text-decoration: line-through; }

  /* TipTap Text-Align Extension */
  [style*="text-align"] { display: block; }
</style>
</head>
<body>
${letterheadHtml}
<div class="content">
${substituted}
</div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
