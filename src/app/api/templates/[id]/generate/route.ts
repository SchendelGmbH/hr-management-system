import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { buildVariableMap } from '@/lib/templateVariables';
import { generateTemplatePdf } from '@/lib/generateTemplatePdf';
import { getNextColor } from '@/lib/categoryColors';

// POST /api/templates/[id]/generate – PDF für Mitarbeiter generieren
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { employeeId, title, categories, validFrom, expirationDate, customVariables, parentDocumentId, pageNumbers } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId fehlt' }, { status: 400 });
    }

    // Template laden
    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Vorlage nicht gefunden' }, { status: 404 });
    }

    // Mitarbeiter mit allen relevanten Feldern laden (Prisma entschlüsselt automatisch)
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

    // Variablen substituieren und PDF generieren
    // customVariables überschreiben/ergänzen die Standard-Variablen
    const variables = {
      ...buildVariableMap(employee),
      ...(customVariables && typeof customVariables === 'object' ? customVariables : {}),
    };
    const pdfBuffer = await generateTemplatePdf(
      template.content,
      variables,
      globalLetterheadPath,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      pageNumbers === true
    );

    // Datei speichern
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents', String(year), month);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const documentTitle = (title?.trim() || template.name).trim();
    const safeTitle = documentTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_. ]/g, '_').slice(0, 60);
    const filename = `${employeeId}-${Date.now()}-${safeTitle}.pdf`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, pdfBuffer);
    const relativePath = `/uploads/documents/${year}/${month}/${filename}`;

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

    let containerId: string;
    let versionNumber: number;

    if (parentDocumentId) {
      // ── NEUE VERSION: an bestehendem Container anhängen ──────────────────
      const container = await prisma.document.findUnique({ where: { id: parentDocumentId } });
      if (!container) {
        return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 });
      }
      containerId = parentDocumentId;

      const latest = await prisma.document.aggregate({
        where: { parentDocumentId: containerId },
        _max: { versionNumber: true },
      });
      versionNumber = (latest._max.versionNumber ?? 0) + 1;

      // Vorgänger-Versionen automatisch ablaufen lassen wenn validFrom gesetzt
      if (parsedValidFrom) {
        const dayBefore = new Date(parsedValidFrom);
        dayBefore.setDate(dayBefore.getDate() - 1);
        await prisma.document.updateMany({
          where: { parentDocumentId: containerId, isContainer: false, expirationDate: null },
          data: { expirationDate: dayBefore },
        });
      }

      // Container-Metadaten aktualisieren
      await prisma.document.update({
        where: { id: containerId },
        data: {
          validFrom: parsedValidFrom,
          expirationDate: parsedExpiration,
          categories: { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });
    } else {
      // ── NEUES DOKUMENT: Container + Version 1 erstellen ──────────────────
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
      containerId = container.id;
      versionNumber = 1;
    }

    // Version erstellen
    await prisma.document.create({
      data: {
        employeeId,
        title: documentTitle,
        filePath: relativePath,
        fileName: `${safeTitle}.pdf`,
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        validFrom: parsedValidFrom,
        expirationDate: parsedExpiration,
        uploadedBy: session.user.id,
        isContainer: false,
        parentDocumentId: containerId,
        versionNumber,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Document',
        entityId: containerId,
        newValues: JSON.stringify({
          title: documentTitle,
          generatedFromTemplate: template.name,
          employee: `${employee.firstName} ${employee.lastName}`,
          ...(parentDocumentId ? { newVersion: versionNumber } : {}),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      documentId: containerId,
      downloadUrl: relativePath,
    });
  } catch (error) {
    console.error('Error generating document from template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
