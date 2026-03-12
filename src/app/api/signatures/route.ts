import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/events/EventBus';

// GET /api/signatures - Liste alle Signatur-Anfragen
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const type = searchParams.get('type'); // 'received' | 'sent'

  try {
    let where: any = {};

    if (type === 'received') {
      // Anfragen, bei denen User Teilnehmer ist
      where = {
        participants: {
          some: {
            userId: session.user.id,
          },
        },
      };
    } else if (type === 'sent') {
      // Anfragen, die User erstellt hat
      where = {
        createdById: session.user.id,
      };
    }

    if (status) {
      where.status = status;
    }

    const requests = await prisma.documentSignatureRequest.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            fileName: true,
            filePath: true,
            mimeType: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                employee: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        signatures: {
          include: {
            signer: {
              select: {
                id: true,
                username: true,
                employee: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching signature requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/signatures - Neue Signatur-Anfrage erstellen
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId, title, message, signerIds, roomId } = body;

    if (!documentId || !signerIds || !Array.isArray(signerIds) || signerIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Prüfe, ob Dokument existiert
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Erstelle Signatur-Anfrage
    const signatureRequest = await prisma.documentSignatureRequest.create({
      data: {
        documentId,
        title: title || `Signatur-Anfrage: ${document.fileName || 'Dokument'}`,
        message: message || '',
        createdById: session.user.id,
        roomId: roomId || null,
        status: 'PENDING',
      },
    });

    // Füge Empfänger als Teilnehmer hinzu
    for (const signerId of signerIds) {
      await prisma.documentSignatureParticipant.create({
        data: {
          requestId: signatureRequest.id,
          userId: signerId,
          role: 'SIGNER',
        },
      });

      // Erstelle Benachrichtigung
      await prisma.notification.create({
        data: {
          userId: signerId,
          type: 'SIGNATURE_REQUESTED',
          title: 'Signatur-Anfrage',
          message: `${title || 'Neue Signatur-Anfrage'}: ${document.fileName || 'Dokument'}`,
          relatedEntityType: 'DocumentSignatureRequest',
          relatedEntityId: signatureRequest.id,
        },
      });
    }

    // Sende Event
    eventBus.emit('document.signature.requested', {
      requestId: signatureRequest.id,
      documentId,
      signerIds,
      roomId: roomId || null,
    });

    return NextResponse.json(
      { 
        message: 'Signature request created',
        request: signatureRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating signature request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
