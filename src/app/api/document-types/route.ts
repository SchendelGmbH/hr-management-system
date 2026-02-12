import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const documentTypes = await prisma.documentType.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ documentTypes });
  } catch (error) {
    console.error('Error fetching document types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
