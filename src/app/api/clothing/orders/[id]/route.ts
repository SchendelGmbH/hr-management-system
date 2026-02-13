import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// GET /api/clothing/orders/[id] - Einzelne Bestellung abrufen
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
    const order = await prisma.clothingOrder.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            remainingBudget: true,
            clothingBudget: true,
          },
        },
        items: {
          include: {
            clothingItem: true,
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/clothing/orders/[id] - Status ändern (Budget-Logik!)
const updateOrderSchema = z.object({
  status: z.enum(['ORDERED', 'DELIVERED', 'RETURNED']),
  notes: z.string().optional(),
});

export async function PUT(
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
    const { status, notes } = updateOrderSchema.parse(body);

    // Alte Bestellung abrufen
    const oldOrder = await prisma.clothingOrder.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            remainingBudget: true,
          },
        },
      },
    });

    if (!oldOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const oldStatus = oldOrder.status;
    const employee = oldOrder.employee;

    // Budget-Logik basierend auf Status-Übergängen
    let budgetChange = 0;
    const updateData: any = {
      status,
    };

    // Notes nur aktualisieren wenn angegeben
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // ORDERED → DELIVERED: Budget abziehen
    if (oldStatus === 'ORDERED' && status === 'DELIVERED') {
      budgetChange = -Number(oldOrder.totalAmount);
      updateData.deliveredAt = new Date();
    }

    // DELIVERED → RETURNED: Budget zurückgeben
    if (oldStatus === 'DELIVERED' && status === 'RETURNED') {
      budgetChange = Number(oldOrder.totalAmount);
      updateData.returnedAt = new Date();
    }

    // ORDERED → RETURNED: Kein Budget-Effekt (war nie abgezogen)
    if (oldStatus === 'ORDERED' && status === 'RETURNED') {
      budgetChange = 0;
      updateData.returnedAt = new Date();
    }

    // Rückwärts-Transitionen verhindern
    if (
      (oldStatus === 'DELIVERED' && status === 'ORDERED') ||
      (oldStatus === 'RETURNED' && (status === 'ORDERED' || status === 'DELIVERED'))
    ) {
      return NextResponse.json(
        {
          error: 'Invalid status transition',
          details: `Cannot change from ${oldStatus} to ${status}`,
        },
        { status: 400 }
      );
    }

    // Keine Änderung wenn gleicher Status
    if (oldStatus === status) {
      return NextResponse.json(
        { error: 'Status is already ' + status },
        { status: 400 }
      );
    }

    // Transaktion: Bestellung aktualisieren + Budget anpassen
    const [updatedOrder] = await prisma.$transaction([
      prisma.clothingOrder.update({
        where: { id },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              remainingBudget: true,
              clothingBudget: true,
            },
          },
          items: {
            include: {
              clothingItem: true,
            },
          },
        },
      }),
      ...(budgetChange !== 0
        ? [
            prisma.employee.update({
              where: { id: employee.id },
              data: {
                remainingBudget: {
                  increment: budgetChange, // negativ = abziehen, positiv = zurückgeben
                },
              },
            }),
          ]
        : []),
    ]);

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'ClothingOrder',
        entityId: id,
        oldValues: JSON.stringify({
          status: oldStatus,
          remainingBudget: employee.remainingBudget,
        }),
        newValues: JSON.stringify({
          status,
          remainingBudget: Number(employee.remainingBudget) + budgetChange,
          budgetChange,
        }),
      },
    });

    const budgetChangeText =
      budgetChange < 0
        ? 'abgezogen'
        : budgetChange > 0
          ? 'zurückgegeben'
          : 'unverändert';

    return NextResponse.json({
      order: updatedOrder,
      budgetChange,
      message: `Status von ${oldStatus} zu ${status} geändert. Budget ${budgetChangeText} (${Math.abs(budgetChange).toFixed(2)} €).`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/clothing/orders/[id] - Bestellung löschen
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await prisma.clothingOrder.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Wenn Status DELIVERED war, Budget zurückgeben beim Löschen
    let budgetRefund = 0;
    if (order.status === 'DELIVERED') {
      budgetRefund = Number(order.totalAmount);
    }

    await prisma.$transaction([
      prisma.clothingOrder.delete({ where: { id } }),
      ...(budgetRefund > 0
        ? [
            prisma.employee.update({
              where: { id: order.employeeId },
              data: {
                remainingBudget: {
                  increment: budgetRefund,
                },
              },
            }),
          ]
        : []),
    ]);

    // Audit-Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'ClothingOrder',
        entityId: id,
        oldValues: JSON.stringify({
          order: {
            id: order.id,
            employeeId: order.employeeId,
            totalAmount: order.totalAmount,
            status: order.status,
          },
          budgetRefunded: budgetRefund,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      budgetRefunded: budgetRefund,
      message: budgetRefund > 0
        ? `Bestellung gelöscht. Budget zurückgegeben: ${budgetRefund.toFixed(2)} €`
        : 'Bestellung gelöscht.',
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
