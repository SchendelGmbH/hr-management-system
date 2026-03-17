import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestChat() {
  try {
    console.log('Creating test chat room...');

    // Find admin and testuser
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      include: { employee: true },
    });

    const testUser = await prisma.user.findUnique({
      where: { username: 'testuser' },
      include: { employee: true },
    });

    const sebastian = await prisma.user.findUnique({
      where: { username: 'sebastian.hegger' },
      include: { employee: true },
    });

    if (!admin) {
      console.error('Admin user not found');
      return;
    }

    if (!testUser) {
      console.error('Testuser not found');
      return;
    }

    console.log('Found users:');
    console.log('- Admin:', admin.id, admin.username);
    console.log('- Testuser:', testUser.id, testUser.username);
    if (sebastian) {
      console.log('- Sebastian:', sebastian.id, sebastian.username);
    }

    // Check if test room already exists
    const existingRoom = await prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: admin.id } } },
          { members: { some: { userId: testUser.id } } },
        ],
      },
    });

    if (existingRoom) {
      console.log('Test room already exists:', existingRoom.id);
    } else {
      // Create test room
      const room = await prisma.chatRoom.create({
        data: {
          name: 'Test Chat (Admin & Testuser)',
          type: 'DIRECT',
          createdBy: admin.id,
          members: {
            create: [
              { userId: admin.id, role: 'MEMBER' },
              { userId: testUser.id, role: 'MEMBER' },
            ],
          },
        },
      });

      console.log('Created test room:', room.id);

      // Add some test messages
      await prisma.chatMessage.createMany({
        data: [
          {
            content: 'Hallo! Das ist ein Test-Chat.',
            senderId: admin.id,
            roomId: room.id,
          },
          {
            content: 'Hi Admin! Ich bin der Testuser.',
            senderId: testUser.id,
            roomId: room.id,
          },
          {
            content: 'Wie funktioniert der Chat?',
            senderId: admin.id,
            roomId: room.id,
          },
          {
            content: 'Alles super! Lokale Speicherung und Echtzeit funktionieren.',
            senderId: testUser.id,
            roomId: room.id,
          },
        ],
      });

      console.log('Added test messages');
    }

    // Create room with Sebastian if exists
    if (sebastian) {
      const existingSebastianRoom = await prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: admin.id } } },
            { members: { some: { userId: sebastian.id } } },
          ],
        },
      });

      if (existingSebastianRoom) {
        console.log('Sebastian room already exists:', existingSebastianRoom.id);
      } else {
        const sebastianRoom = await prisma.chatRoom.create({
          data: {
            name: 'Chat mit Sebastian',
            type: 'DIRECT',
            createdBy: admin.id,
            members: {
              create: [
                { userId: admin.id, role: 'MEMBER' },
                { userId: sebastian.id, role: 'MEMBER' },
              ],
            },
          },
        });

        console.log('Created Sebastian room:', sebastianRoom.id);

        // Add test messages
        await prisma.chatMessage.createMany({
          data: [
            {
              content: 'Hallo Sebastian!',
              senderId: admin.id,
              roomId: sebastianRoom.id,
            },
            {
              content: 'Hi! Wie geht es dir?',
              senderId: sebastian.id,
              roomId: sebastianRoom.id,
            },
          ],
        });

        console.log('Added test messages to Sebastian room');
      }
    }

    // Create a group chat
    const existingGroup = await prisma.chatRoom.findFirst({
      where: {
        type: 'GROUP',
        name: 'Test-Gruppe',
      },
    });

    if (!existingGroup) {
      const groupRoom = await prisma.chatRoom.create({
        data: {
          name: 'Test-Gruppe',
          type: 'GROUP',
          description: 'Eine Test-Gruppe für alle',
          createdBy: admin.id,
          members: {
            create: [
              { userId: admin.id, role: 'OWNER' },
              { userId: testUser.id, role: 'MEMBER' },
              ...(sebastian ? [{ userId: sebastian.id, role: 'MEMBER' }] : []),
            ],
          },
        },
      });

      console.log('Created group room:', groupRoom.id);

      // Add welcome message
      await prisma.chatMessage.create({
        data: {
          content: 'Willkommen in der Test-Gruppe! 👋',
          senderId: admin.id,
          roomId: groupRoom.id,
        },
      });

      console.log('Added welcome message to group');
    } else {
      console.log('Group room already exists:', existingGroup.id);
    }

    console.log('\n✅ Test chat setup complete!');
    console.log('You can now open the chat and see the rooms.');

  } catch (error) {
    console.error('Error creating test chat:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestChat();
