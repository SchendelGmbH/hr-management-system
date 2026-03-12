import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/events/EventBus';

// POST /api/signatures/[id]/sign - Dokument unterschreiben
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { signatureData, pageNumber = 1, positionX, positionY } = body;

    if (!signatureData) {
      return NextResponse.json(
        { error: 'Signature data is required' },
        { status: 400 }
      );
    }

    // Prüfe Anfrage
    const signatureRequest = await prisma.documentSignatureRequest.findUnique({
      where: { id },
      include: {
        participants: true,
        document: {
          select: {
            id: true,
            fileName: true,
            filePath: true,
          },
        },
      },
    });

    if (!signatureRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Prüfe, ob User berechtigt ist zu unterschreiben
    const isSigner = signatureRequest.participants.some(
      (p: any) => p.userId === session.user.id && p.role === 'SIGNER'
    );

    if (!isSigner && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You are not authorized to sign this document' },
        { status: 403 }
      );
    }

    // Prüfe Status
    if (signatureRequest.status !== 'PENDING' && signatureRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Cannot sign document in status ${signatureRequest.status}` },
        { status: 400 }
      );
    }

    // Hole IP und User-Agent
    const headers = request.headers;
    const ipAddress = headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown';
    const userAgent = headers.get('user-agent') || 'unknown';

    // Erstelle Signatur
    const signature = await prisma.documentSignature.create({
      data: {
        requestId: id,
        signerId: session.user.id,
        signatureData,
        pageNumber,
        positionX: positionX ?? null,
        positionY: positionY ?? null,
        ipAddress: ipAddress.toString(),
        userAgent,
      },
    });

    // Update Anfrage-Status
    await prisma.documentSignatureRequest.update({
      where: { id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
      },
    });

    // Update Participant
    await prisma.documentSignatureParticipant.updateMany({
      where: {
        requestId: id,
        userId: session.user.id,
        role: 'SIGNER',
      },
      data: {
        actedAt: new Date(),
      },
    });

    // Benachrichtige Creator
    await prisma.notification.create({
      data: {
        userId: signatureRequest.createdById,
        type: 'SIGNATURE_SIGNED',
        title: 'Dokument signiert',
        message: `Ihre Signatur-Anfrage für "${signatureRequest.document?.fileName || 'Dokument'}" wurde unterschrieben.`,
        relatedEntityType: 'DocumentSignatureRequest',
        relatedEntityId: signatureRequest.id,
      },
    });

    // Emit Event
    eventBus.emit('document.signature.signed', {
      requestId: id,
      signatureId: signature.id,
      signerId: session.user.id,
    });

    return NextResponse.json({
      message: 'Document signed successfully',
      signature,
    });
  } catch (error) {
    console.error('Error signing document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
