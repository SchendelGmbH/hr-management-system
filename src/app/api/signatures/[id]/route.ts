import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { eventBus } from '@/lib/events/EventBus';

// GET /api/signatures/[id] - Einzelne Anfrage abrufen
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const request = await prisma.documentSignatureRequest.findUnique({
      where: { id },
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
        room: {
          select: {
            id: true,
            name: true,
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
          orderBy: { signedAt: 'asc' },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Prüfe, ob User berechtigt ist
    const isCreator = request.createdById === session.user.id;
    const isParticipant = request.participants.some(p => p.userId === session.user.id);

    if (!isCreator && !isParticipant && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ request });
  } catch (error) {
    console.error('Error fetching signature request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/signatures/[id] - Anfrage aktualisieren
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { status, note } = body;

    const signatureRequest = await prisma.documentSignatureRequest.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!signatureRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Berechtigungsprüfung je nach Status-Wechsel
    const isCreator = signatureRequest.createdById === session.user.id;
    const isParticipant = signatureRequest.participants.some(p => p.userId === session.user.id);

    if (!isCreator && !isParticipant && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let updateData: any = {};

    // Status-Wechsel validieren
    if (status) {
      const validTransitions: { [key: string]: string[] } = {
        'PENDING': ['APPROVED', 'REJECTED', 'CANCELLED'],
        'APPROVED': ['SIGNED', 'CANCELLED'],
        'SIGNED': [],
        'REJECTED': [],
        'CANCELLED': [],
      };

      const currentStatus = signatureRequest.status;
      if (!validTransitions[currentStatus]?.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentStatus} to ${status}` },
          { status: 400 }
        );
      }

      updateData.status = status;

      if (status === 'APPROVED') {
        updateData.approvedAt = new Date();
      } else if (status === 'SIGNED') {
        updateData.signedAt = new Date();
      } else if (status === 'REJECTED') {
        updateData.rejectedAt = new Date();
      }
    }

    const updated = await prisma.documentSignatureRequest.update({
      where: { id },
      data: updateData,
    });

    // Emit Event
    if (status === 'APPROVED') {
      eventBus.emit('document.signature.approved', { requestId: id });
    } else if (status === 'REJECTED') {
      eventBus.emit('document.signature.rejected', { requestId: id, reason: note });
    }

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error('Error updating signature request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
