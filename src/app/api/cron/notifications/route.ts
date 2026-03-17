import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/notifications/index';
import { addDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Cron endpoint for checking and sending notifications
 * Call with: GET /api/cron/notifications?token=CRON_SECRET_TOKEN
 * 
 * This should be configured to run once per day via external scheduler
 * (e.g., Vercel Cron, GitHub Actions, or similar)
 * 
 * Checks for:
 * - Documents expiring soon (7 days)
 * - Documents expired
 * - Qualifications expiring soon (30 days)
 * - Qualifications expired
 * - Upcoming vacations (starting in 7 days)
 */
export async function GET(req: NextRequest) {
  // Verify cron token
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  
  if (token !== process.env.CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      documentsExpiringSoon: 0,
      documentsExpired: 0,
      qualificationsExpiringSoon: 0,
      qualificationsExpired: 0,
      upcomingVacations: 0,
      errors: [] as string[],
    };

    const now = new Date();
    const in7Days = addDays(now, 7);
    const in30Days = addDays(now, 30);

    // 1. Check documents expiring in 7 days
    try {
      const documentsExpiringSoon = await prisma.document.findMany({
        where: {
          expirationDate: {
            gte: startOfDay(now),
            lte: endOfDay(in7Days),
          },
          isContainer: true,
        },
        include: {
          employee: {
            include: {
              user: true,
            },
          },
        },
      });

      for (const doc of documentsExpiringSoon) {
        if (doc.employee?.user) {
          // Check if notification already sent today
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: doc.employee.user.id,
              type: 'DOCUMENT_EXPIRING',
              relatedEntityId: doc.id,
              createdAt: {
                gte: startOfDay(now),
              },
            },
          });

          if (!existingNotification) {
            await sendNotification({
              userId: doc.employee.user.id,
              type: 'DOCUMENT_EXPIRING',
              title: 'Dokument läuft bald ab',
              message: `Das Dokument "${doc.title}" läuft am ${doc.expirationDate?.toLocaleDateString('de-DE')} ab.`,
              priority: 'HIGH',
              relatedEntityType: 'Document',
              relatedEntityId: doc.id,
              actionUrl: `/documents/${doc.id}`,
            });
            results.documentsExpiringSoon++;
          }
        }
      }
    } catch (error) {
      console.error('Error checking documents expiring soon:', error);
      results.errors.push('documentsExpiringSoon');
    }

    // 2. Check expired documents
    try {
      const documentsExpired = await prisma.document.findMany({
        where: {
          expirationDate: {
            lt: startOfDay(now),
          },
          isContainer: true,
        },
        include: {
          employee: {
            include: {
              user: true,
            },
          },
        },
      });

      for (const doc of documentsExpired) {
        if (doc.employee?.user) {
          // Check if notification already sent today
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: doc.employee.user.id,
              type: 'DOCUMENT_EXPIRED',
              relatedEntityId: doc.id,
              createdAt: {
                gte: startOfDay(now),
              },
            },
          });

          if (!existingNotification) {
            await sendNotification({
              userId: doc.employee.user.id,
              type: 'DOCUMENT_EXPIRED',
              title: 'Dokument abgelaufen',
              message: `Das Dokument "${doc.title}" ist am ${doc.expirationDate?.toLocaleDateString('de-DE')} abgelaufen.`,
              priority: 'URGENT',
              relatedEntityType: 'Document',
              relatedEntityId: doc.id,
              actionUrl: `/documents/${doc.id}`,
            });
            results.documentsExpired++;
          }
        }
      }
    } catch (error) {
      console.error('Error checking expired documents:', error);
      results.errors.push('documentsExpired');
    }

    // 3. Check qualifications expiring in 30 days
    try {
      const qualificationsExpiringSoon = await prisma.qualification.findMany({
        where: {
          expiresAt: {
            gte: startOfDay(now),
            lte: endOfDay(in30Days),
          },
        },
        include: {
          employee: {
            include: {
              user: true,
            },
          },
          type: true,
        },
      });

      for (const qual of qualificationsExpiringSoon) {
        if (qual.employee?.user) {
          // Check if notification already sent today
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: qual.employee.user.id,
              type: 'QUALIFICATION_EXPIRING',
              relatedEntityId: qual.id,
              createdAt: {
                gte: startOfDay(now),
              },
            },
          });

          if (!existingNotification) {
            await sendNotification({
              userId: qual.employee.user.id,
              type: 'QUALIFICATION_EXPIRING',
              title: 'Qualifikation läuft bald ab',
              message: `Die Qualifikation "${qual.type.name}" läuft am ${qual.expiresAt?.toLocaleDateString('de-DE')} ab.`,
              priority: 'HIGH',
              relatedEntityType: 'Qualification',
              relatedEntityId: qual.id,
              actionUrl: `/employees/${qual.employee.id}/qualifications`,
            });
            results.qualificationsExpiringSoon++;
          }
        }
      }
    } catch (error) {
      console.error('Error checking qualifications expiring soon:', error);
      results.errors.push('qualificationsExpiringSoon');
    }

    // 4. Check expired qualifications
    try {
      const qualificationsExpired = await prisma.qualification.findMany({
        where: {
          expiresAt: {
            lt: startOfDay(now),
          },
        },
        include: {
          employee: {
            include: {
              user: true,
            },
          },
          type: true,
        },
      });

      for (const qual of qualificationsExpired) {
        if (qual.employee?.user) {
          // Check if notification already sent today
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: qual.employee.user.id,
              type: 'QUALIFICATION_EXPIRED',
              relatedEntityId: qual.id,
              createdAt: {
                gte: startOfDay(now),
              },
            },
          });

          if (!existingNotification) {
            await sendNotification({
              userId: qual.employee.user.id,
              type: 'QUALIFICATION_EXPIRED',
              title: 'Qualifikation abgelaufen',
              message: `Die Qualifikation "${qual.type.name}" ist am ${qual.expiresAt?.toLocaleDateString('de-DE')} abgelaufen.`,
              priority: 'URGENT',
              relatedEntityType: 'Qualification',
              relatedEntityId: qual.id,
              actionUrl: `/employees/${qual.employee.id}/qualifications`,
            });
            results.qualificationsExpired++;
          }
        }
      }
    } catch (error) {
      console.error('Error checking expired qualifications:', error);
      results.errors.push('qualificationsExpired');
    }

    // 5. Check upcoming vacations (starting in 7 days)
    try {
      const upcomingVacations = await prisma.vacation.findMany({
        where: {
          startDate: {
            gte: startOfDay(in7Days),
            lte: endOfDay(in7Days),
          },
        },
        include: {
          employee: {
            include: {
              user: true,
            },
          },
        },
      });

      for (const vacation of upcomingVacations) {
        if (vacation.employee?.user) {
          // Check if notification already sent today
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: vacation.employee.user.id,
              type: 'UPCOMING_VACATION',
              relatedEntityId: vacation.id,
              createdAt: {
                gte: startOfDay(now),
              },
            },
          });

          if (!existingNotification) {
            await sendNotification({
              userId: vacation.employee.user.id,
              type: 'UPCOMING_VACATION',
              title: 'Urlaub beginnt bald',
              message: `Dein Urlaub vom ${vacation.startDate.toLocaleDateString('de-DE')} bis ${vacation.endDate.toLocaleDateString('de-DE')} beginnt in 7 Tagen.`,
              priority: 'NORMAL',
              relatedEntityType: 'Vacation',
              relatedEntityId: vacation.id,
              actionUrl: `/calendar`,
            });
            results.upcomingVacations++;
          }
        }
      }
    } catch (error) {
      console.error('Error checking upcoming vacations:', error);
      results.errors.push('upcomingVacations');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('Error checking notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
