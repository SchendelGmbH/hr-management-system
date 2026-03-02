/**
 * Server-seitige PDF-Generierung aus TipTap-HTML-Templates.
 * Verwendet Puppeteer (Chromium) für exaktes 1:1-Rendering des Editor-HTML
 * und pdf-lib um das Briefpapier als Hintergrund auf jeder Seite einzubetten.
 * Nur in API-Routes verwenden – nicht im Client.
 */
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { substituteVariables } from './templateVariables';

/**
 * Liest das Briefpapier-Bild und wandelt es in einen Buffer um.
 */
async function getLetterheadBuffer(letterheadPath: string): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const rel = letterheadPath.startsWith('/') ? letterheadPath.slice(1) : letterheadPath;
    const absPath = join(process.cwd(), 'public', rel);
    const buffer = await readFile(absPath);
    const ext = rel.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return { buffer, mime };
  } catch {
    return null;
  }
}

/**
 * Rendert das Briefpapier als einzelne PDF-Seite (ohne Margins, Bild füllt die ganze A4-Seite).
 */
async function renderLetterheadPdf(
  letterheadBuffer: Buffer,
  mime: string
): Promise<Buffer> {
  // Data-URL für Puppeteer
  const dataUrl = `data:${mime};base64,${letterheadBuffer.toString('base64')}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; width: 210mm; height: 297mm; overflow: hidden; }
  img { display: block; width: 210mm; height: 297mm; }
</style>
</head>
<body>
<img src="${dataUrl}" alt="">
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Rendert den Inhalt als PDF mit korrekten Seitenrändern, aber ohne Briefpapier.
 */
async function renderContentPdf(
  content: string,
  marginTop: number,
  marginBottom: number,
  marginLeft: number,
  marginRight: number,
  pageNumbers: boolean = false
): Promise<Buffer> {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    font-weight: normal;
    line-height: 1.5;
    color: #1a1a1a;
  }

  /* TipTap-Standard-HTML-Elemente */
  p { margin: 0 0 8pt 0; min-height: 1.5em; }
  h1 { font-size: 18pt; font-weight: bold; margin: 6pt 0 10pt 0; }
  h2 { font-size: 16pt; font-weight: bold; margin: 5pt 0 8pt 0; }
  h3 { font-size: 14pt; font-weight: bold; margin: 4pt 0 6pt 0; }
  ul, ol { padding-left: 20pt; margin-bottom: 8pt; }
  li { margin-bottom: 4pt; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  s { text-decoration: line-through; }
  [style*="text-align"] { display: block; }
</style>
</head>
<body>
<div class="content">
${content}
</div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  // Seitennummer-Footer: rendert im unteren Randbereich, rechts ausgerichtet
  const footerTemplate = `<div style="
    width: 100%;
    font-size: 9pt;
    color: #888888;
    font-family: Arial, Helvetica, sans-serif;
    text-align: right;
    padding-right: ${marginRight}mm;
    padding-bottom: 4mm;
    box-sizing: border-box;
  "><span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: false,
      margin: {
        top: `${marginTop}mm`,
        bottom: `${marginBottom}mm`,
        left: `${marginLeft}mm`,
        right: `${marginRight}mm`,
      },
      displayHeaderFooter: pageNumbers,
      headerTemplate: '<span></span>',
      footerTemplate: pageNumbers ? footerTemplate : '<span></span>',
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateTemplatePdf(
  htmlContent: string,
  variables: Record<string, string>,
  letterheadPath: string | null,
  marginTop: number = 40,
  marginBottom: number = 20,
  marginLeft: number = 25,
  marginRight: number = 25,
  pageNumbers: boolean = false
): Promise<Buffer> {
  const substituted = substituteVariables(htmlContent, variables);

  // Ohne Briefpapier: einfach Content-PDF zurückgeben
  if (!letterheadPath) {
    return renderContentPdf(substituted, marginTop, marginBottom, marginLeft, marginRight, pageNumbers);
  }

  const letterheadData = await getLetterheadBuffer(letterheadPath);
  if (!letterheadData) {
    // Briefpapier nicht gefunden → ohne Briefpapier rendern
    return renderContentPdf(substituted, marginTop, marginBottom, marginLeft, marginRight, pageNumbers);
  }

  // Beide PDFs parallel rendern
  const [letterheadPdfBuffer, contentPdfBuffer] = await Promise.all([
    renderLetterheadPdf(letterheadData.buffer, letterheadData.mime),
    renderContentPdf(substituted, marginTop, marginBottom, marginLeft, marginRight, pageNumbers),
  ]);

  // Mit pdf-lib zusammenführen: Briefpapier als Hintergrund auf jede Content-Seite legen
  const letterheadDoc = await PDFDocument.load(letterheadPdfBuffer);
  const contentDoc = await PDFDocument.load(contentPdfBuffer);

  const finalDoc = await PDFDocument.create();

  // Briefpapier-Seite einmal einbetten (wird für alle Content-Seiten verwendet)
  const [embeddedLetterhead] = await finalDoc.embedPdf(letterheadDoc, [0]);
  const letterheadDims = embeddedLetterhead.size();

  const contentPageCount = contentDoc.getPageCount();

  for (let i = 0; i < contentPageCount; i++) {
    const [embeddedContent] = await finalDoc.embedPdf(contentDoc, [i]);
    const contentDims = embeddedContent.size();

    const newPage = finalDoc.addPage([contentDims.width, contentDims.height]);

    // 1. Briefpapier als Hintergrund (zuerst gezeichnet = hinter allem)
    newPage.drawPage(embeddedLetterhead, {
      x: 0,
      y: 0,
      width: letterheadDims.width,
      height: letterheadDims.height,
    });

    // 2. Content-Seite darüber (transparenter Hintergrund → Briefpapier schimmert durch)
    newPage.drawPage(embeddedContent, {
      x: 0,
      y: 0,
      width: contentDims.width,
      height: contentDims.height,
    });
  }

  const finalPdfBytes = await finalDoc.save();
  return Buffer.from(finalPdfBytes);
}
