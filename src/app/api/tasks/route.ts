import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime().optional().nullable(),
  sourceRoomId: z.string().optional(),
  sourceMessageId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const assigneeId = searchParams.get('assigneeId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = createTaskSchema.parse(body);

    const task = await prisma.task.create({
      data: {
        title: validated.title,
        description: validated.description,
        status: validated.status,
        priority: validated.priority,
        assigneeId: validated.assigneeId,
        createdById: session.user.id,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
        sourceRoomId: validated.sourceRoomId,
        sourceMessageId: validated.sourceMessageId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.taskAuditLog.create({
      data: {
        taskId: task.id,
        action: 'CREATED',
        newValue: JSON.stringify(task),
        performedById: session.user.id,
      },
    });

    // Create notification for assignee if set
    if (validated.assigneeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: validated.assigneeId },
        include: { user: true },
      });

      if (employee?.user) {
        await prisma.notification.create({
          data: {
            userId: employee.user.id,
            type: 'TASK_ASSIGNED',
            title: 'Neue Aufgabe zugewiesen',
            message: `Dir wurde "${validated.title}" zugewiesen.`,
            relatedEntityType: 'Task',
            relatedEntityId: task.id,
          },
        });

        // Emit socket event if available
        if (global.io) {
          global.io.to(`user:${employee.user.id}`).emit('notification:new', {
            type: 'TASK_ASSIGNED',
            taskId: task.id,
            title: validated.title,
          });
        }
      }
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
