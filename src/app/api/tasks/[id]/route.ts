import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
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
        auditLogs: {
          include: {
            performedBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = updateTaskSchema.parse(body);

    // Get current task for audit log
    const currentTask = await prisma.task.findUnique({
      where: { id },
      include: { assignee: true },
    });

    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.assigneeId !== undefined) updateData.assigneeId = validated.assigneeId;
    if (validated.priority !== undefined) updateData.priority = validated.priority;
    if (validated.dueDate !== undefined) {
      updateData.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
    }

    // Handle status change
    if (validated.status && validated.status !== currentTask.status) {
      updateData.status = validated.status;
      if (validated.status === 'DONE') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },
    });

    // Create audit log
    const changes: any = {};
    if (validated.title && validated.title !== currentTask.title) changes.title = { from: currentTask.title, to: validated.title };
    if (validated.status && validated.status !== currentTask.status) changes.status = { from: currentTask.status, to: validated.status };
    if (validated.assigneeId && validated.assigneeId !== currentTask.assigneeId) changes.assigneeId = { from: currentTask.assigneeId, to: validated.assigneeId };

    if (Object.keys(changes).length > 0) {
      await prisma.taskAuditLog.create({
        data: {
          taskId: id,
          action: validated.status && validated.status !== currentTask.status ? 'STATUS_CHANGED' : 'UPDATED',
          oldValue: JSON.stringify(currentTask),
          newValue: JSON.stringify(updatedTask),
          performedById: session.user.id,
        },
      });
    }

    // Handle assignee change notification
    if (validated.assigneeId && validated.assigneeId !== currentTask.assigneeId && validated.assigneeId !== session.user.id) {
      const employee = await prisma.employee.findUnique({
        where: { id: validated.assigneeId },
        include: { user: true },
      });

      if (employee?.user) {
        await prisma.notification.create({
          data: {
            userId: employee.user.id,
            type: 'TASK_ASSIGNED',
            title: 'Aufgabe zugewiesen',
            message: `Dir wurde "${updatedTask.title}" zugewiesen.`,
            relatedEntityType: 'Task',
            relatedEntityId: id,
          },
        });

        if (global.io) {
          global.io.to(`user:${employee.user.id}`).emit('notification:new', {
            type: 'TASK_ASSIGNED',
            taskId: id,
            title: updatedTask.title,
          });
        }
      }
    }

    // Handle completion notification to creator
    if (validated.status === 'DONE' && currentTask.status !== 'DONE' && currentTask.createdById !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: currentTask.createdById,
          type: 'TASK_COMPLETED',
          title: 'Aufgabe abgeschlossen',
          message: `"${updatedTask.title}" wurde von ${session.user.name || 'einem Teammitglied'} abgeschlossen.`,
          relatedEntityType: 'Task',
          relatedEntityId: id,
        },
      });
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only creator or admin can delete
    if (task.createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create audit log before deletion
    await prisma.taskAuditLog.create({
      data: {
        taskId: id,
        action: 'DELETED',
        oldValue: JSON.stringify(task),
        performedById: session.user.id,
      },
    });

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
