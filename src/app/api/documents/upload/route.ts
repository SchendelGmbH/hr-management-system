import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getNextColor } from '@/lib/categoryColors';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const employeeId = formData.get('employeeId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const validFrom = formData.get('validFrom') as string;
    const expirationDate = formData.get('expirationDate') as string;
    const notes = formData.get('notes') as string;
    const categoriesJson = formData.get('categories') as string;
    // parentDocumentId now points to the CONTAINER (not v1)
    const parentDocumentId = formData.get('parentDocumentId') as string | null;

    let categoryNames: string[] = [];
    if (categoriesJson) {
      try {
        categoryNames = JSON.parse(categoriesJson);
      } catch (error) {
        console.error('Error parsing categories:', error);
      }
    }

    if (!file || !employeeId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 10 MB' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, JPG, PNG, and DOCX are allowed.' },
        { status: 400 }
      );
    }

    // Create upload directory structure
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents', String(year), month);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${employeeId}-${timestamp}-${sanitizedFilename}`;
    const filepath = join(uploadDir, filename);
    const relativePath = `/uploads/documents/${year}/${month}/${filename}`;

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Process categories: create if new, find if existing
    if (categoryNames.length === 0 && parentDocumentId) {
      // Inherit categories from container if none provided
      const container = await prisma.document.findUnique({
        where: { id: parentDocumentId },
        include: { categories: { include: { category: true } } },
      });
      if (container) {
        categoryNames = container.categories.map((dc) => dc.category.name);
      }
    }

    // Bereits verwendete Farben laden, damit neue Kategorien keine Duplikate bekommen
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
        category = await prisma.category.create({
          data: { name: trimmedName, color },
        });
      }

      categoryIds.push(category.id);
    }

    const parsedExpiration = expirationDate ? new Date(expirationDate) : null;
    const parsedValidFrom = validFrom ? new Date(validFrom) : null;

    let containerId: string;
    let versionNumber: number;

    if (!parentDocumentId) {
      // ── NEW DOCUMENT: create container + v1 ──────────────────────────────
      const container = await prisma.document.create({
        data: {
          employeeId,
          title,
          description: description || null,
          filePath: null,
          fileName: null,
          fileSize: null,
          mimeType: null,
          validFrom: parsedValidFrom,
          expirationDate: parsedExpiration,
          notes: notes || null,
          uploadedBy: session.user.id,
          isContainer: true,
          versionNumber: 0,
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
      });
      containerId = container.id;
      versionNumber = 1;
    } else {
      // ── NEW VERSION: determine next version number ────────────────────────
      containerId = parentDocumentId;
      const latestVersion = await prisma.document.aggregate({
        where: { parentDocumentId: containerId },
        _max: { versionNumber: true },
      });
      versionNumber = (latestVersion._max.versionNumber ?? 0) + 1;
    }

    // Create the version document (v1, v2, v3, ...)
    const document = await prisma.document.create({
      data: {
        employeeId,
        title,
        description: description || null,
        filePath: relativePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        validFrom: parsedValidFrom,
        expirationDate: parsedExpiration,
        notes: notes || null,
        uploadedBy: session.user.id,
        isContainer: false,
        parentDocumentId: containerId,
        versionNumber,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
        categories: { include: { category: true } },
      },
    });

    // Auto-set expirationDate on previous version if it has none and new version has validFrom
    if (parentDocumentId && parsedValidFrom) {
      const dayBefore = new Date(parsedValidFrom);
      dayBefore.setDate(dayBefore.getDate() - 1);

      await prisma.document.updateMany({
        where: {
          parentDocumentId: containerId,
          isContainer: false,
          id: { not: document.id },
          expirationDate: null,
        },
        data: {
          expirationDate: dayBefore,
        },
      });
    }

    // Update container metadata to reflect the latest version
    await prisma.document.update({
      where: { id: containerId },
      data: {
        expirationDate: parsedExpiration,
        validFrom: parsedValidFrom,
        // Update container categories to match the new version
        categories: {
          deleteMany: {},
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
    });

    // Create audit log
    const categoryNamesList = document.categories.map((dc) => dc.category.name).join(', ');
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Document',
        entityId: document.id,
        newValues: JSON.stringify({
          title,
          version: versionNumber,
          containerId,
          categories: categoryNamesList,
          employee: `${document.employee.firstName} ${document.employee.lastName}`,
        }),
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
