import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];

/** Extract extension from filename */
function getExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

/** Validate file by magic bytes */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  const b = buffer;
  
  switch (mimeType) {
    case 'application/pdf':
      return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
    case 'image/jpeg':
    case 'image/jpg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case 'image/gif':
      return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
    case 'image/webp':
      return b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    default:
      return true; // For other types, rely on extension
  }
}

/** Generate thumbnail for images */
async function generateThumbnail(buffer: Buffer, filename: string, uploadDir: string): Promise<{ thumbnailPath: string | null; width: number; height: number }> {
  try {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    if (width === 0 || height === 0) {
      return { thumbnailPath: null, width, height };
    }
    
    // Generate thumbnail for large images
    if (width > 400 || height > 400) {
      const thumbnailFilename = `thumb-${filename}`;
      const thumbnailPath = join(uploadDir, thumbnailFilename);
      
      await sharp(buffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      return { thumbnailPath: `/uploads/chat/thumbnails/${thumbnailFilename}`, width, height };
    }
    
    return { thumbnailPath: null, width, height };
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return { thumbnailPath: null, width: 0, height: 0 };
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const roomId = formData.get('roomId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    // Check if user is a member of the room
    const membership = await prisma.chatMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || membership.isMuted) {
      return NextResponse.json({ error: 'Not a member or muted' }, { status: 403 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: images, PDF, DOC, DOCX, XLS, XLSX, TXT' },
        { status: 400 }
      );
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate magic bytes
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: 'File content does not match the declared file type' },
        { status: 400 }
      );
    }

    // Create upload directory
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'chat', String(year), month);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${session.user.id}-${timestamp}-${sanitizedFilename}`;
    const filepath = join(uploadDir, filename);
    const extension = getExtension(sanitizedFilename);
    
    // Determine file type category
    const isImage = file.type.startsWith('image/');
    const typeCategory = isImage ? 'image' : 'file';

    // Write file
    await writeFile(filepath, buffer);

    // Generate thumbnail for images
    let thumbnailPath: string | null = null;
    let width = 0;
    let height = 0;
    
    if (isImage) {
      const thumbResult = await generateThumbnail(buffer, `${session.user.id}-${timestamp}-thumb.jpg`, uploadDir);
      thumbnailPath = thumbResult.thumbnailPath;
      width = thumbResult.width;
      height = thumbResult.height;
    }

    const relativePath = `/uploads/chat/${year}/${month}/${filename}`;

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: typeCategory,
        mimeType: file.type,
        url: relativePath,
        thumbnailUrl: thumbnailPath,
        width,
        height,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Download file (returns file or redirects)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');
    const attachmentId = searchParams.get('id');

    if (attachmentId) {
      // Get file info from database
      const attachment = await prisma.chatAttachment.findUnique({
        where: { id: attachmentId },
        include: { message: { select: { roomId: true } } },
      });

      if (!attachment) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Check if user is member of the room
      const membership = await prisma.chatMember.findUnique({
        where: {
          roomId_userId: {
            roomId: attachment.message.roomId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Serve file
      const filepath = join(process.cwd(), 'public', attachment.filePath);
      const fileBuffer = await require('fs').promises.readFile(filepath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': attachment.mimeType,
          'Content-Disposition': `inline; filename="${attachment.fileName}"`,
        },
      });
    }

    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
