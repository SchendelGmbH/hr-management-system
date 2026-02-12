import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const employeeId = searchParams.get('employeeId');

  try {
    const where: any = {};
    if (employeeId) {
      where.employeeId = employeeId;
    }

    const orders = await prisma.clothingOrder.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
        items: {
          include: {
            clothingItem: true,
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { employeeId, items, notes } = body;

    if (!employeeId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Budget-Check (aber nicht abziehen!)
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        firstName: true,
        lastName: true,
        employeeNumber: true,
        remainingBudget: true,
        clothingBudget: true
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Calculate total amount
    const itemsWithPrices = await Promise.all(
      items.map(async (item: any) => {
        const clothingItem = await prisma.clothingItem.findUnique({
          where: { id: item.clothingItemId },
        });
        if (!clothingItem) {
          throw new Error(`Clothing item not found: ${item.clothingItemId}`);
        }
        return {
          ...item,
          unitPrice: clothingItem.basePrice,
          totalPrice: clothingItem.basePrice * item.quantity,
        };
      })
    );

    const totalAmount = itemsWithPrices.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0
    );

    // Warnung wenn Budget überschritten (aber nicht blockieren)
    if (totalAmount > Number(employee.remainingBudget)) {
      console.warn(
        `Order exceeds budget for employee ${employeeId}: ${totalAmount} > ${employee.remainingBudget}`
      );
    }

    // Create order with items (Status: ORDERED, Budget NICHT abziehen)
    const order = await prisma.clothingOrder.create({
      data: {
        employeeId,
        orderDate: new Date(),
        totalAmount,
        status: 'ORDERED',
        notes,
        createdBy: session.user.id,
        items: {
          create: itemsWithPrices.map((item) => ({
            clothingItemId: item.clothingItemId,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        employee: {
          select: {
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
    });

    // BUDGET WIRD HIER NICHT MEHR ABGEZOGEN!
    // Budget-Abzug erfolgt erst bei Status-Update auf DELIVERED

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'ClothingOrder',
        entityId: order.id,
        newValues: JSON.stringify({
          employee: `${order.employee.firstName} ${order.employee.lastName}`,
          totalAmount,
          itemCount: items.length,
          status: 'ORDERED',
          note: 'Budget will be deducted when status changes to DELIVERED',
        }),
      },
    });

    return NextResponse.json({
      order,
      warning: totalAmount > Number(employee.remainingBudget)
        ? 'Order exceeds employee budget'
        : undefined
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
