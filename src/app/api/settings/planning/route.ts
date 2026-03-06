import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const KEYS = [
  'planning_site_retention_days',
  'planning_pool_departments',
  'planning_default_start_time',
  'planning_default_end_time',
  'planning_auto_carry_over',
  'planning_weekend_mode',
] as const;

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...KEYS] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    siteRetentionDays: parseInt(map.planning_site_retention_days ?? '30', 10),
    poolDepartments: map.planning_pool_departments
      ? (JSON.parse(map.planning_pool_departments) as string[])
      : [],
    defaultStartTime: map.planning_default_start_time ?? '06:00',
    defaultEndTime: map.planning_default_end_time ?? '16:00',
    autoCarryOver: (map.planning_auto_carry_over ?? 'true') !== 'false',
    weekendMode: (map.planning_weekend_mode ?? 'both') as 'none' | 'saturday' | 'both',
  });
}

export async function PUT(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json() as {
    siteRetentionDays?: number;
    poolDepartments?: string[];
    defaultStartTime?: string;
    defaultEndTime?: string;
    autoCarryOver?: boolean;
    weekendMode?: 'none' | 'saturday' | 'both';
  };

  const upserts: { key: string; value: string }[] = [];

  if (body.siteRetentionDays !== undefined) {
    const val = Math.max(1, parseInt(String(body.siteRetentionDays), 10) || 30);
    upserts.push({ key: 'planning_site_retention_days', value: String(val) });
  }
  if (body.poolDepartments !== undefined) {
    upserts.push({ key: 'planning_pool_departments', value: JSON.stringify(body.poolDepartments) });
  }
  if (body.defaultStartTime !== undefined) {
    upserts.push({ key: 'planning_default_start_time', value: body.defaultStartTime });
  }
  if (body.defaultEndTime !== undefined) {
    upserts.push({ key: 'planning_default_end_time', value: body.defaultEndTime });
  }
  if (body.autoCarryOver !== undefined) {
    upserts.push({ key: 'planning_auto_carry_over', value: String(body.autoCarryOver) });
  }
  if (body.weekendMode !== undefined) {
    upserts.push({ key: 'planning_weekend_mode', value: body.weekendMode });
  }

  await Promise.all(
    upserts.map((u) =>
      prisma.systemSetting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
