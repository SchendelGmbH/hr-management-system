/**
 * Server-seitige PDF-Generierung aus TipTap-HTML-Templates.
 * Verwendet Puppeteer (Chromium) für exaktes 1:1-Rendering des Editor-HTML
 * und pdf-lib um das Briefpapier als Hintergrund auf jeder Seite einzubetten.
 * Nur in API-Routes verwenden – nicht im Client.
 */
import puppeteer from 'puppeteer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
export async function renderContentPdf(
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
  hr { border: none; border-top: 1pt solid #cccccc; margin: 12pt 0; }
  p[style*="text-align"] { display: block; }
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

/**
 * Wie generateTemplatePdf, liefert aber zusätzlich den Content-only-Buffer für den Druck
 * auf physischem Briefpapier zurück – ohne Extra-Renders gegenüber generateTemplatePdf.
 * `print` ist null wenn kein Briefbogen konfiguriert ist (digital = content = identisch).
 */
export async function generateTemplatePdfBoth(
  htmlContent: string,
  variables: Record<string, string>,
  letterheadPath: string | null,
  marginTop: number = 40,
  marginBottom: number = 20,
  marginLeft: number = 25,
  marginRight: number = 25,
  pageNumbers: boolean = false
): Promise<{ digital: Buffer; print: Buffer | null }> {
  const substituted = substituteVariables(htmlContent, variables);

  if (!letterheadPath) {
    const digital = await renderContentPdf(substituted, marginTop, marginBottom, marginLeft, marginRight, pageNumbers);
    return { digital, print: null };
  }

  const letterheadData = await getLetterheadBuffer(letterheadPath);
  if (!letterheadData) {
    const digital = await renderContentPdf(substituted, marginTop, marginBottom, marginLeft, marginRight, pageNumbers);
    return { digital, print: null };
  }

  // Beide PDFs parallel rendern (identisch zu generateTemplatePdf)
  const [letterheadPdfBuffer, contentPdfBuffer] = await Promise.all([
    renderLetterheadPdf(letterheadData.buffer, letterheadData.mime),
    renderContentPdf(substituted, marginTop, marginBottom, marginLeft, marginRight, pageNumbers),
  ]);

  // Mit pdf-lib zusammenführen
  const letterheadDoc = await PDFDocument.load(letterheadPdfBuffer);
  const contentDoc = await PDFDocument.load(contentPdfBuffer);
  const finalDoc = await PDFDocument.create();
  const [embeddedLetterhead] = await finalDoc.embedPdf(letterheadDoc, [0]);
  const letterheadDims = embeddedLetterhead.size();
  const contentPageCount = contentDoc.getPageCount();

  for (let i = 0; i < contentPageCount; i++) {
    const [embeddedContent] = await finalDoc.embedPdf(contentDoc, [i]);
    const contentDims = embeddedContent.size();
    const newPage = finalDoc.addPage([contentDims.width, contentDims.height]);
    newPage.drawPage(embeddedLetterhead, { x: 0, y: 0, width: letterheadDims.width, height: letterheadDims.height });
    newPage.drawPage(embeddedContent, { x: 0, y: 0, width: contentDims.width, height: contentDims.height });
  }

  const digitalBuffer = Buffer.from(await finalDoc.save());
  return { digital: digitalBuffer, print: contentPdfBuffer };
}

/**
 * Fügt mehrere vorgerenderte Content-PDFs (inkl. Zusammenfassungsseite als letztem Element)
 * zu einem einzigen PDF zusammen und legt optional das Briefpapier als Hintergrund auf jede Seite.
 * Die Buffers werden von der API-Route per renderContentPdf vorgerendert.
 */
export async function generateGroupPdf(
  contentBuffers: Buffer[],
  letterheadPath: string | null,
  marginTop: number = 40,
  marginBottom: number = 20,
  marginLeft: number = 25,
  marginRight: number = 25,
  pageNumbers: boolean = false
): Promise<Buffer> {
  if (contentBuffers.length === 0) {
    throw new Error('generateGroupPdf: mindestens ein contentBuffer erforderlich');
  }

  // Alle Content-PDFs per pdf-lib zu einem einzigen Dokument zusammenführen
  const combinedDoc = await PDFDocument.create();
  for (const buf of contentBuffers) {
    const srcDoc = await PDFDocument.load(buf);
    const pageCount = srcDoc.getPageCount();
    if (pageCount === 0) continue;
    const copied = await combinedDoc.copyPages(srcDoc, Array.from({ length: pageCount }, (_, i) => i));
    for (const p of copied) combinedDoc.addPage(p);
  }

  // Zieldokument: entweder mit oder ohne Briefpapier aufbauen
  let targetDoc: PDFDocument;

  if (!letterheadPath) {
    targetDoc = combinedDoc;
  } else {
    const letterheadData = await getLetterheadBuffer(letterheadPath);
    if (!letterheadData) {
      targetDoc = combinedDoc;
    } else {
      const letterheadPdfBuffer = await renderLetterheadPdf(letterheadData.buffer, letterheadData.mime);
      const letterheadDoc = await PDFDocument.load(letterheadPdfBuffer);

      targetDoc = await PDFDocument.create();
      const [embeddedLetterhead] = await targetDoc.embedPdf(letterheadDoc, [0]);
      const letterheadDims = embeddedLetterhead.size();

      const totalCombinedPages = combinedDoc.getPageCount();
      for (let i = 0; i < totalCombinedPages; i++) {
        const [embeddedContent] = await targetDoc.embedPdf(combinedDoc, [i]);
        const contentDims = embeddedContent.size();

        const newPage = targetDoc.addPage([contentDims.width, contentDims.height]);
        newPage.drawPage(embeddedLetterhead, { x: 0, y: 0, width: letterheadDims.width, height: letterheadDims.height });
        newPage.drawPage(embeddedContent, { x: 0, y: 0, width: contentDims.width, height: contentDims.height });
      }
    }
  }

  // Seitennummern als Text-Overlay auf jede Seite zeichnen (durchlaufend über alle Segmente)
  if (pageNumbers) {
    const font = await targetDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 9;
    const MM_TO_PT = 2.8346;
    const rightPt = marginRight * MM_TO_PT;
    const bottomPt = (marginBottom / 3) * MM_TO_PT;
    const totalPages = targetDoc.getPageCount();

    for (let i = 0; i < totalPages; i++) {
      const page = targetDoc.getPage(i);
      const { width } = page.getSize();
      const text = `${i + 1} / ${totalPages}`;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: width - textWidth - rightPt,
        y: bottomPt,
        size: fontSize,
        font,
        color: rgb(0.533, 0.533, 0.533),
      });
    }
  }

  return Buffer.from(await targetDoc.save());
}
