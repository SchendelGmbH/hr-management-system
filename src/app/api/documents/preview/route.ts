import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

// GET /api/documents/preview - PDF-File für Vorschau
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'File path is required' }, { status: 400 });
  }

  try {
    // Sicherheit: Prüfe, dass Pfad innerhalb des Upload-Verzeichnisses liegt
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const fullPath = path.resolve(uploadDir, filePath);
    const resolvedUploadDir = path.resolve(uploadDir);

    // Verhindere Path Traversal
    if (!fullPath.startsWith(resolvedUploadDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    // Prüfe, ob Datei existiert
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Lese Datei
    const fileBuffer = fs.readFileSync(fullPath);
    const fileName = path.basename(fullPath);

    // Setze Content-Type
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `inline; filename="${fileName}"`);

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    console.error('Error serving PDF preview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
