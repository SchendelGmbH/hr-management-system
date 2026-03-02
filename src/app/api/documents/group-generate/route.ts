import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { buildVariableMap, substituteVariables } from '@/lib/templateVariables';
import { renderContentPdf, generateGroupPdf } from '@/lib/generateTemplatePdf';
import { getNextColor } from '@/lib/categoryColors';
import { PDFDocument } from 'pdf-lib';

// POST /api/documents/group-generate – Mehrere Vorlagen zu einer Dokumentengruppe zusammenführen
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      employeeId,
      templateIds,
      customVariables,
      title,
      categories,
      validFrom,
      expirationDate,
      companyName,
      signingCity,
      pageNumbers,
    } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId fehlt' }, { status: 400 });
    }
    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      return NextResponse.json({ error: 'Mindestens eine Vorlage auswählen' }, { status: 400 });
    }

    // Mitarbeiter laden
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { name: true } },
        payGrade: { select: { name: true, tariffWage: true } },
      },
    });
    if (!employee) {
      return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
    }

    // Globale PDF-Einstellungen laden
    const pdfSettingsRows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['letterhead_path', 'pdf_margin_top', 'pdf_margin_bottom', 'pdf_margin_left', 'pdf_margin_right'],
        },
      },
    });
    const settingsMap = Object.fromEntries(pdfSettingsRows.map((s) => [s.key, s.value]));
    const globalLetterheadPath = settingsMap['letterhead_path'] ?? null;
    const marginTop = Number(settingsMap['pdf_margin_top'] ?? '40');
    const marginBottom = Number(settingsMap['pdf_margin_bottom'] ?? '20');
    const marginLeft = Number(settingsMap['pdf_margin_left'] ?? '25');
    const marginRight = Number(settingsMap['pdf_margin_right'] ?? '25');

    // Alle Vorlagen laden (Reihenfolge aus templateIds beibehalten)
    const templatesRaw = await prisma.documentTemplate.findMany({
      where: { id: { in: templateIds } },
    });
    const templateMap = new Map(templatesRaw.map((t) => [t.id, t]));
    const orderedTemplates = templateIds.map((id: string) => templateMap.get(id)).filter(Boolean);

    if (orderedTemplates.length !== templateIds.length) {
      const missing = templateIds.filter((id: string) => !templateMap.has(id));
      return NextResponse.json({ error: `Vorlage(n) nicht gefunden: ${missing.join(', ')}` }, { status: 404 });
    }

    // Basisvariablen aus Mitarbeiterdaten
    const baseVars = buildVariableMap(employee);

    // Jede Vorlage rendern + Seitenanzahl ermitteln
    const contentBuffers: Buffer[] = [];
    const pageCounts: number[] = [];
    const templateNames: string[] = [];

    for (const template of orderedTemplates) {
      const mergedVars = {
        ...baseVars,
        ...((customVariables as Record<string, Record<string, string>>)?.[template.id] ?? {}),
      };
      const substitutedHtml = substituteVariables(template.content, mergedVars);
      const buf = await renderContentPdf(substitutedHtml, marginTop, marginBottom, marginLeft, marginRight);
      const pageCount = (await PDFDocument.load(buf)).getPageCount();
      contentBuffers.push(buf);
      pageCounts.push(pageCount);
      templateNames.push(template.name);
    }

    // Seitenranges berechnen
    let cumulativePage = 1;
    const documentRows = pageCounts.map((count, i) => {
      const startPage = cumulativePage;
      const endPage = cumulativePage + count - 1;
      cumulativePage += count;
      return { startPage, endPage, name: templateNames[i] };
    });

    // Zusammenfassungsseite bauen
    const employeeFullName = `${employee.firstName} ${employee.lastName}`;
    const now = new Date();
    const signingDate = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const summaryHtml = buildSummaryHtml({
      documentRows,
      employeeFullName,
      companyName: companyName?.trim() || 'Arbeitgeber',
      signingCity: signingCity?.trim() || '',
      signingDate,
    });
    const summaryBuffer = await renderContentPdf(summaryHtml, marginTop, marginBottom, marginLeft, marginRight);

    // Alle Buffers zusammenführen + Briefpapier überlagern (digitale Version)
    const allBuffers = [...contentBuffers, summaryBuffer];
    const pdfBuffer = await generateGroupPdf(
      allBuffers,
      globalLetterheadPath,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      pageNumbers === true
    );

    // Druckversion (ohne Briefbogen) – nur pdf-lib copyPages, kein extra Puppeteer-Render
    let printBuffer: Buffer | null = null;
    if (globalLetterheadPath) {
      printBuffer = await generateGroupPdf(
        allBuffers,
        null,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        pageNumbers === true
      );
    }

    // Datei speichern
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents', String(year), month);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const documentTitle = (title?.trim() || orderedTemplates[0].name).trim();
    const safeTitle = documentTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_. ]/g, '_').slice(0, 60);
    const ts = Date.now();
    const filename = `${employeeId}-${ts}-${safeTitle}.pdf`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, pdfBuffer);
    const relativePath = `/uploads/documents/${year}/${month}/${filename}`;

    // Druckversion speichern
    let printRelativePath: string | null = null;
    if (printBuffer) {
      const printFilename = `${employeeId}-${ts}-${safeTitle}-print.pdf`;
      await writeFile(join(uploadDir, printFilename), printBuffer);
      printRelativePath = `/uploads/documents/${year}/${month}/${printFilename}`;
    }

    // Kategorien verarbeiten
    const categoryNames: string[] = Array.isArray(categories) ? categories : [];
    const existingColors = (await prisma.category.findMany({ select: { color: true } }))
      .map((c) => c.color)
      .filter(Boolean) as string[];
    const categoryIds: string[] = [];
    for (const categoryName of categoryNames) {
      const trimmedName = categoryName.trim();
      if (!trimmedName) continue;
      let category = await prisma.category.findFirst({
        where: { name: { equals: trimmedName, mode: 'insensitive' } },
      });
      if (!category) {
        const color = getNextColor(existingColors);
        existingColors.push(color);
        category = await prisma.category.create({ data: { name: trimmedName, color } });
      }
      categoryIds.push(category.id);
    }

    const parsedValidFrom = validFrom ? new Date(validFrom) : null;
    const parsedExpiration = expirationDate ? new Date(expirationDate) : null;

    // Container + Version anlegen
    const container = await prisma.document.create({
      data: {
        employeeId,
        title: documentTitle,
        filePath: null,
        fileName: null,
        fileSize: null,
        mimeType: null,
        validFrom: parsedValidFrom,
        expirationDate: parsedExpiration,
        uploadedBy: session.user.id,
        isContainer: true,
        versionNumber: 0,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });

    await prisma.document.create({
      data: {
        employeeId,
        title: documentTitle,
        filePath: relativePath,
        printFilePath: printRelativePath,
        fileName: `${safeTitle}.pdf`,
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        validFrom: parsedValidFrom,
        expirationDate: parsedExpiration,
        uploadedBy: session.user.id,
        isContainer: false,
        parentDocumentId: container.id,
        versionNumber: 1,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Document',
        entityId: container.id,
        newValues: JSON.stringify({
          title: documentTitle,
          generatedFromTemplates: templateNames.join(', '),
          templateCount: templateIds.length,
          employee: employeeFullName,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      documentId: container.id,
      downloadUrl: relativePath,
    });
  } catch (error) {
    console.error('Error generating group document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface SummaryPageData {
  documentRows: Array<{ startPage: number; endPage: number; name: string }>;
  employeeFullName: string;
  companyName: string;
  signingCity: string;
  signingDate: string;
}

function buildSummaryHtml(data: SummaryPageData): string {
  const rows = data.documentRows
    .map((row, i) => {
      const pageRange = row.startPage === row.endPage
        ? `${row.startPage}`
        : `${row.startPage}–${row.endPage}`;
      return `
        <tr>
          <td style="padding: 4pt 12pt 4pt 0; font-size: 11pt;">${i + 1}.</td>
          <td style="padding: 4pt 16pt 4pt 0; font-size: 11pt;">${pageRange}</td>
          <td style="padding: 4pt 0; font-size: 11pt;">${row.name}</td>
        </tr>`;
    })
    .join('');

  const cityDateLine = data.signingCity
    ? `${data.signingCity}, den ${data.signingDate}`
    : `den ${data.signingDate}`;

  return `
<h2 style="font-size: 13pt; font-weight: bold; margin: 0 0 20pt 0; letter-spacing: 0.05em; text-transform: uppercase;">
  Bestätigung zum Arbeitsvertrag
</h2>

<p style="margin: 0 0 16pt 0; font-size: 11pt;">Der Arbeitsvertrag beinhaltet folgende Dokumente:</p>

<table style="border-collapse: collapse; margin-bottom: 28pt; width: auto;">
  <thead>
    <tr>
      <th style="text-align: left; padding: 4pt 12pt 6pt 0; font-size: 11pt; border-bottom: 1pt solid #333; font-weight: bold;"></th>
      <th style="text-align: left; padding: 4pt 16pt 6pt 0; font-size: 11pt; border-bottom: 1pt solid #333; font-weight: bold;">Seite</th>
      <th style="text-align: left; padding: 4pt 0 6pt 0; font-size: 11pt; border-bottom: 1pt solid #333; font-weight: bold;">Dokument</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<p style="margin: 0 0 48pt 0; font-size: 11pt;">
  Beide Parteien stimmen über den Inhalt der Vereinbarungen überein.
</p>

<p style="margin: 0 0 64pt 0; font-size: 11pt;">${cityDateLine}</p>

<table style="width: 90%; border-collapse: collapse;">
  <tr>
    <td style="width: 44%; vertical-align: top; padding-top: 6pt; border-top: 1pt solid #333; font-size: 11pt;">
      ${data.companyName}<br>
      <span style="font-size: 10pt; color: #555;">(Arbeitgeber)</span>
    </td>
    <td style="width: 12%;"></td>
    <td style="width: 44%; vertical-align: top; padding-top: 6pt; border-top: 1pt solid #333; font-size: 11pt;">
      ${data.employeeFullName}<br>
      <span style="font-size: 10pt; color: #555;">(Arbeitnehmer)</span>
    </td>
  </tr>
</table>`;
}
