import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const employeeId = formData.get('employeeId') as string;
    const documentTypeId = formData.get('documentTypeId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const expirationDate = formData.get('expirationDate') as string;
    const notes = formData.get('notes') as string;
    const tagsJson = formData.get('tags') as string;

    let tagNames: string[] = [];
    if (tagsJson) {
      try {
        tagNames = JSON.parse(tagsJson);
      } catch (error) {
        console.error('Error parsing tags:', error);
      }
    }

    if (!file || !employeeId || !documentTypeId || !title) {
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

    // Process tags: create if new, find if existing
    const tagIds: string[] = [];
    for (const tagName of tagNames) {
      const trimmedTagName = tagName.trim();
      if (!trimmedTagName) continue;

      // Try to find existing tag (case-insensitive)
      let tag = await prisma.tag.findFirst({
        where: {
          name: {
            equals: trimmedTagName,
            mode: 'insensitive',
          },
        },
      });

      // Create tag if it doesn't exist
      if (!tag) {
        tag = await prisma.tag.create({
          data: {
            name: trimmedTagName,
            color: '#3B82F6',
          },
        });
      }

      tagIds.push(tag.id);
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        employeeId,
        documentTypeId,
        title,
        description: description || null,
        filePath: relativePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        notes: notes || null,
        uploadedBy: session.user.id,
        tags: {
          create: tagIds.map((tagId) => ({
            tagId,
          })),
        },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        documentType: {
          select: {
            name: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Document',
        entityId: document.id,
        newValues: JSON.stringify({
          title,
          documentType: document.documentType.name,
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
