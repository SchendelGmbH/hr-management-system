import { prisma } from '@/lib/prisma';
import { emitEvent, TaskEvents } from '@/lib/eventBus';
import { isPast, isToday, addDays } from 'date-fns';

/**
 * Check for overdue tasks and emit events
 */
export async function checkOverdueTasks() {
  const now = new Date();
  const tomorrow = addDays(now, 1);

  // Find tasks due soon (next 24 hours)
  const tasksDueSoon = await prisma.task.findMany({
    where: {
      dueDate: {
        gte: now,
        lte: tomorrow,
      },
      status: {
        in: ['TODO', 'IN_PROGRESS'],
      },
      // Only notify once per day - could track lastNotified
    },
    include: {
      assignee: {
        include: {
          user: true,
        },
      },
    },
  });

  for (const task of tasksDueSoon) {
    if (task.assignee?.user) {
      // Create notification
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: task.assignee.user.id,
          type: 'TASK_DUE_SOON',
          relatedEntityId: task.id,
          createdAt: {
            gte: new Date(now.setHours(0, 0, 0, 0)), // Today
          },
        },
      });

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId: task.assignee.user.id,
            type: 'TASK_DUE_SOON',
            title: 'Aufgabe fällig bald',
            message: `"${task.title}" ist morgen fällig.`,
            relatedEntityType: 'Task',
            relatedEntityId: task.id,
          },
        });

        emitEvent(TaskEvents.TASK_DUE_SOON, {
          taskId: task.id,
          title: task.title,
          assigneeId: task.assignee.user.id,
          dueDate: task.dueDate,
        });
      }
    }
  }

  // Find overdue tasks
  const overdueTasks = await prisma.task.findMany({
    where: {
      dueDate: {
        lt: new Date(now.setHours(0, 0, 0, 0)), // Before today
      },
      status: {
        in: ['TODO', 'IN_PROGRESS'],
      },
    },
    include: {
      assignee: {
        include: {
          user: true,
        },
      },
    },
  });

  for (const task of overdueTasks) {
    if (task.assignee?.user) {
      // Only create notification if not already notified today
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: task.assignee.user.id,
          type: 'TASK_OVERDUE',
          relatedEntityId: task.id,
          createdAt: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
          },
        },
      });

      if (!existingNotification) {
        await prisma.notification.create({
          data: {
            userId: task.assignee.user.id,
            type: 'TASK_OVERDUE',
            title: 'Aufgabe überfällig',
            message: `"${task.title}" ist überfällig.`,
            relatedEntityType: 'Task',
            relatedEntityId: task.id,
          },
        });

        emitEvent(TaskEvents.TASK_OVERDUE, {
          taskId: task.id,
          title: task.title,
          assigneeId: task.assignee.user.id,
          dueDate: task.dueDate,
        });
      }
    }
  }

  console.log(`[Task Notifications] Checked: ${tasksDueSoon.length} due soon, ${overdueTasks.length} overdue`);
}

/**
 * Schedule periodic checks
 */
export function startTaskNotificationScheduler() {
  // Run every hour
  const interval = setInterval(() => {
    checkOverdueTasks().catch(console.error);
  }, 60 * 60 * 1000);

  // Initial run
  checkOverdueTasks().catch(console.error);

  return () => clearInterval(interval);
}
