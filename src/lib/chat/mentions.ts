import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Regex to parse mentions from content: @Name (userId)
const MENTION_REGEX = /@(\S[^@\n\r]*?)(?:\s*\(([^)]+)\))?(?=\s|$|[^\w\s])/g;

export async function extractMentions(content: string): Promise<{ userId: string; name: string }[]> {
  const mentions: { userId: string; name: string }[] = [];
  let match;

  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const name = match[1].trim();
    const userId = match[2];

    if (userId) {
      mentions.push({ userId, name });
    }
  }

  return mentions;
}

export async function createMentions(
  messageId: string,
  senderId: string,
  mentions: { userId: string; name: string }[]
) {
  const uniqueMentions = mentions.filter(
    (mention, index, self) =>
      index === self.findIndex((m) => m.userId === mention.userId)
  ).filter(mention => mention.userId !== senderId); // Don't notify self

  if (uniqueMentions.length === 0) return;

  try {
    // Create mention records
    await prisma.chatMention.createMany({
      data: uniqueMentions.map((mention) => ({
        messageId,
        senderId,
        mentionedUserId: mention.userId,
      })),
      skipDuplicates: true,
    });

    // Create notifications for each mentioned user
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
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
            name: true,
          },
        },
      },
    });

    if (message) {
      const senderName =
        message.sender?.employee
          ? `${message.sender.employee.firstName} ${message.sender.employee.lastName}`
          : message.sender?.username || 'Jemand';

      const roomName = message.room?.name || 'Unbekannter Raum';

      // Create notifications for all mentioned users
      for (const mention of uniqueMentions) {
        await prisma.notification.create({
          data: {
            userId: mention.userId,
            type: 'CHAT_MENTION',
            title: `${senderName} hat dich erwähnt`,
            message: `In ${roomName}: "${message.content.slice(0, 100)}${message.content.length > 100 ? '...' : ''}"`,
            data: {
              messageId: messageId,
              roomId: message.roomId,
              roomName,
              senderId,
              senderName,
              content: message.content,
            },
            actionUrl: `/chat?room=${message.roomId}#message-${messageId}`,
          },
        });

        // Send realtime notification via WebSocket if available
        try {
          const { getSocketIO } = await import('@/app/api/socket/route');
          const io = getSocketIO();
          if (io) {
            io.to(`user:${mention.userId}`).emit('mention-notification', {
              id: messageId,
              roomId: message.roomId,
              roomName,
              senderName,
              content: message.content.slice(0, 150),
              timestamp: new Date().toISOString(),
            });
          }
        } catch (e) {
          // Socket not available, ignore
        }
      }
    }
  } catch (error) {
    console.error('Error creating mentions:', error);
  }
}
