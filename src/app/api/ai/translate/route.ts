import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { translateText } from '@/lib/ai/client';

// POST /api/ai/translate - Translate text between German and Polish
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text, targetLang, roomId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!targetLang || !['de', 'pl'].includes(targetLang)) {
      return NextResponse.json({ error: 'Target language must be "de" or "pl"' }, { status: 400 });
    }

    // Validate room membership if roomId provided
    if (roomId) {
      const { prisma } = await import('@/lib/prisma');
      const membership = await prisma.chatMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
      }
    }

    // Translate text
    const translation = await translateText(text.trim(), targetLang as 'de' | 'pl');

    return NextResponse.json({
      original: text,
      translation,
      targetLang,
      detectedSourceLang: targetLang === 'de' ? 'pl' : 'de',
      translatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error translating text:', error);
    return NextResponse.json(
      {
        error: 'Failed to translate text',
        translation: text, // Return original on error
      },
      { status: 500 }
    );
  }
}

// GET /api/ai/translate - Get translation for a specific message
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const messageId = searchParams.get('messageId');
    const targetLang = searchParams.get('targetLang') as 'de' | 'pl';

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    if (!targetLang || !['de', 'pl'].includes(targetLang)) {
      return NextResponse.json({ error: 'Target language must be "de" or "pl"' }, { status: 400 });
    }

    // Fetch message
    const { prisma } = await import('@/lib/prisma');
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        room: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.room.members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    // Translate message
    const translation = await translateText(message.content, targetLang);

    return NextResponse.json({
      messageId,
      original: message.content,
      translation,
      targetLang,
      translatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error translating message:', error);
    return NextResponse.json({ error: 'Failed to translate message' }, { status: 500 });
  }
}
