import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Parse task command from chat message
 * Format: /task [assignee]: [title] bis [due date]
 * Example: /task Max: Bericht bis Freitag
 * Example: /task @max.mustermann: Wichtige Aufgabe bis 15.03.2025
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, roomId } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check if message starts with /task
    if (!message.trim().startsWith('/task')) {
      return NextResponse.json({ isTaskCommand: false });
    }

    // Parse the command
    const parsed = parseTaskCommand(message);
    if (!parsed.success) {
      return NextResponse.json({ 
        isTaskCommand: true, 
        error: parsed.error,
        help: 'Format: /task [Name]: Aufgabe bis [Datum]'
      }, { status: 400 });
    }

    // Find assignee by name
    let assigneeId: string | null = null;
    if (parsed.assignee) {
      const employees = await prisma.employee.findMany({
        where: {
          OR: [
            { firstName: { contains: parsed.assignee, mode: 'insensitive' } },
            { lastName: { contains: parsed.assignee, mode: 'insensitive' } },
            { user: { username: { contains: parsed.assignee, mode: 'insensitive' } } },
          ],
        },
        take: 5,
      });

      if (employees.length === 1) {
        assigneeId = employees[0].id;
      } else if (employees.length > 1) {
        return NextResponse.json({
          isTaskCommand: true,
          error: 'Mehrere Mitarbeiter gefunden. Bitte spezifischer sein.',
          candidates: employees.map(e => ({ 
            id: e.id, 
            name: `${e.firstName} ${e.lastName}`,
            employeeNumber: e.employeeNumber 
          })),
        }, { status: 400 });
      } else {
        return NextResponse.json({
          isTaskCommand: true,
          error: `Kein Mitarbeiter gefunden für "${parsed.assignee}"`,
        }, { status: 400 });
      }
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        title: parsed.title,
        description: `Erstellt aus Chat: "${message}"`,
        assigneeId,
        createdById: session.user.id,
        dueDate: parsed.dueDate,
        sourceRoomId: roomId || null,
        status: 'TODO',
        priority: 'MEDIUM',
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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

    // Create notification for assignee
    if (assigneeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: assigneeId },
        include: { user: true },
      });

      if (employee?.user) {
        await prisma.notification.create({
          data: {
            userId: employee.user.id,
            type: 'TASK_ASSIGNED',
            title: 'Neue Aufgabe aus Chat',
            message: `Dir wurde "${parsed.title}" zugewiesen.`,
            relatedEntityType: 'Task',
            relatedEntityId: task.id,
          },
        });

        if (global.io) {
          global.io.to(`user:${employee.user.id}`).emit('notification:new', {
            type: 'TASK_ASSIGNED',
            taskId: task.id,
            title: parsed.title,
          });
        }
      }
    }

    return NextResponse.json({
      isTaskCommand: true,
      success: true,
      task,
      message: `✅ Aufgabe "${parsed.title}"${task.assignee ? ` für ${task.assignee.firstName} ${task.assignee.lastName}` : ''} erstellt.`,
    });
  } catch (error) {
    console.error('Error processing task command:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface ParsedTask {
  success: true;
  assignee: string | null;
  title: string;
  dueDate: Date | null;
}

interface ParseError {
  success: false;
  error: string;
}

function parseTaskCommand(message: string): ParsedTask | ParseError {
  // Remove /task prefix
  const content = message.replace(/^\/?task\s*/i, '').trim();
  
  if (!content) {
    return { success: false, error: 'Kein Inhalt angegeben' };
  }

  // Try to parse formats:
  // /task Max: Bericht bis Freitag
  // /task @max: Bericht bis 15.03.2025
  // /task Bericht bis Freitag (no assignee)
  
  let assignee: string | null = null;
  let remainingText = content;
  
  // Check for assignee pattern (Name: or @name: at the start)
  const assigneeMatch = content.match(/^[@]?([^:]+):\s*(.+)$/);
  if (assigneeMatch) {
    assignee = assigneeMatch[1].trim();
    remainingText = assigneeMatch[2].trim();
  }

  // Parse due date from text
  const { title, dueDate } = extractDueDate(remainingText);

  if (!title.trim()) {
    return { success: false, error: 'Kein Aufgabentitel gefunden' };
  }

  return {
    success: true,
    assignee,
    title: title.trim(),
    dueDate,
  };
}

function extractDueDate(text: string): { title: string; dueDate: Date | null } {
  const now = new Date();
  let dueDate: Date | null = null;
  let title = text;

  // German date patterns
  const patterns = [
    // "bis Freitag" / "bis Montag"
    {
      regex: /\s*bis\s+(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonnabend|Sonntag)\b/i,
      extractor: (match: string[]) => {
        const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const dayName = match[1].toLowerCase();
        const dayIndex = days.findIndex(d => d.toLowerCase() === dayName || (dayName === 'sonnabend' && d === 'Samstag'));
        if (dayIndex === -1) return null;
        
        const targetDate = new Date(now);
        const currentDay = targetDate.getDay();
        let daysUntil = dayIndex - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Next week
        targetDate.setDate(targetDate.getDate() + daysUntil);
        targetDate.setHours(23, 59, 59, 999);
        return targetDate;
      }
    },
    // "bis heute" / "bis morgen" / "bis übermorgen"
    {
      regex: /\s*bis\s+(heute|morgen|übermorgen)\b/i,
      extractor: (match: string[]) => {
        const targetDate = new Date(now);
        const keyword = match[1].toLowerCase();
        if (keyword === 'heute') {
          targetDate.setHours(23, 59, 59, 999);
        } else if (keyword === 'morgen') {
          targetDate.setDate(targetDate.getDate() + 1);
          targetDate.setHours(23, 59, 59, 999);
        } else if (keyword === 'übermorgen') {
          targetDate.setDate(targetDate.getDate() + 2);
          targetDate.setHours(23, 59, 59, 999);
        }
        return targetDate;
      }
    },
    // "bis DD.MM.YYYY" / "bis DD.MM.YY"
    {
      regex: /\s*bis\s+(\d{1,2})[\./](\d{1,2})[\./](\d{2,4})\b/,
      extractor: (match: string[]) => {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 0-indexed
        let year = parseInt(match[3]);
        if (year < 100) year += 2000; // Assume 20xx for 2-digit years
        
        const targetDate = new Date(year, month, day, 23, 59, 59, 999);
        return isNaN(targetDate.getTime()) ? null : targetDate;
      }
    },
    // "bis in X Tagen/Wochen"
    {
      regex: /\s*bis\s+in\s+(\d+)\s+(Tag|Tage|Woche|Wochen)\b/i,
      extractor: (match: string[]) => {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const targetDate = new Date(now);
        
        if (unit.startsWith('woche')) {
          targetDate.setDate(targetDate.getDate() + (amount * 7));
        } else {
          targetDate.setDate(targetDate.getDate() + amount);
        }
        targetDate.setHours(23, 59, 59, 999);
        return targetDate;
      }
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      dueDate = pattern.extractor(match);
      if (dueDate) {
        // Remove the date part from title
        title = text.replace(match[0], '').trim();
        break;
      }
    }
  }

  return { title, dueDate };
}
