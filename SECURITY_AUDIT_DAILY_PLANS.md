# Security & Quality Audit — Tagesplanung (Daily Plans)

**Audit Date:** 2026-06-10
**Scope:** `src/app/api/daily-plans/[date]/route.ts`, `src/app/[locale]/planning/[date]/page.tsx`
**Auth Context:** ADMIN (admin/Admin123!) — full; GEWERBLICH (max/Max123!) — `daily_plans:view` + `daily_plans:edit`, `calendar:view/write`, `vacations:request/write/view_own`

---

## Findings Summary

| # | Severity | Category | File:Line |
|---|----------|----------|-----------|
| 1 | HIGH | IDOR — date parameter | route.ts:44-128 |
| 2 | HIGH | Data Exposure — absences unfiltered | route.ts:86-101 |
| 3 | HIGH | poolDepartments bypass via absences | route.ts:87-101 |
| 4 | MEDIUM | No plan-level authorization | route.ts:44-128 |
| 5 | MEDIUM | Template plan data exposure | route.ts:76-84 |
| 6 | MEDIUM | WorkSite auto-upsert privilege escalation | route.ts:194-212 |
| 7 | MEDIUM | Action mapping bug on PUT | route.ts:144 |
| 8 | MEDIUM | No employee-level authorization | route.ts:183-191 |
| 9 | LOW | Missing date format validation | route.ts:8-12 |
| 10 | LOW | Missing input validation on site fields | route.ts:143-155 |
| 11 | LOW | No date range limits | route.ts:44-128 |
| 12 | MEDIUM | Settings access for GEWERBLICH | settings/planning/route.ts:37-39 |
| 13 | MEDIUM | Client-side isAdmin bypassable | page.tsx:125 |
| 14 | MEDIUM | Absence creation without employee authorization | page.tsx:571-600 |

---

## Detailed Findings

---

### Finding 1 — IDOR via `date` Parameter (HIGH)

**File:** `src/app/api/daily-plans/[date]/route.ts:44-128`
**Severity:** HIGH
**CWE:** CWE-639 (Insecure Direct Object Reference)

**Problem:**
Any authenticated user with `daily_plans:view` can access **any date's** plan by changing the URL date parameter. There is no ownership or department-based check — the date is used directly as `where: { date }` (line 22), meaning plans are purely date-keyed, not user-scoped.

```ts
// route.ts:20-42 — loadPlan fetches ANY date with no user filter
async function loadPlan(date: Date) {
  return prisma.dailyPlan.findUnique({
    where: { date },       // ← date from URL, no user scoping
```

A GEWERBLICH user can navigate to `/de/planning/2025-01-01` or any past/future date and see all site assignments and employee data for that day.

**Fix:**
Add date-range guard or user-scoped check:
```ts
// Example: restrict to ±30 days from today
const today = new Date();
today.setHours(0,0,0,0);
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
if (Math.abs(date.getTime() - today.getTime()) > thirtyDaysMs) {
  return NextResponse.json({ error: 'Date out of range' }, { status: 403 });
}
```

Or add a department-ownership model where `DailyPlan` has a `departmentId` field and queries are scoped.

---

### Finding 2 — Data Exposure: Absences Unfiltered (HIGH)

**File:** `src/app/api/daily-plans/[date]/route.ts:86-101`
**Severity:** HIGH
**CWE:** CWE-200 (Exposure of Sensitive Information)

**Problem:**
The absences query returns **ALL employees on vacation** for the date, completely bypassing `poolDepartmentIds`:

```ts
// route.ts:87-101 — NO department filter on absences
const absences = await prisma.vacation.findMany({
  where: {
    startDate: { lte: date },
    endDate: { gte: date },
    // poolDepartmentIds NOT applied here!
  },
  include: {
    employee: {
      select: { id: true, firstName: true, lastName: true,
                employeeNumber: true, position: true,
                department: { select: { name: true } }, // ← exposes all depts
    },
  },
});
```

If `planning_pool_departments` is set to only show "Tiefbau", the API still returns vacations for employees in "Hochbau" and ALL other departments.

**Fix:**
```ts
const absences = await prisma.vacation.findMany({
  where: {
    startDate: { lte: date },
    endDate: { gte: date },
    ...(poolDepartmentIds.length > 0 && {
      employee: { departmentId: { in: poolDepartmentIds } },
    }),
  },
  // ...
});
```

---

### Finding 3 — poolDepartments Bypass via Absences (HIGH)

**File:** `src/app/api/daily-plans/[date]/route.ts:86-101`
**Severity:** HIGH

**Problem (combined with Finding 2):**
The `poolDepartmentIds` filter on line 104-107 only affects the employee pool, not the absences. So even when the UI correctly limits the pool to specific departments, the API returns all vacation records, allowing cross-department data inference (who is on vacation in other departments).

**Fix:** Same as Finding 2 — apply `poolDepartmentIds` to the absences query.

---

### Finding 4 — No Plan-Level Authorization (MEDIUM)

**File:** `src/app/api/daily-plans/[date]/route.ts:44-128`
**Severity:** MEDIUM
**CWE:** CWE-285 (Missing Authorization)

**Problem:**
`requirePermission(request, 'daily_plans', 'view')` (line 48) checks if the user has the `daily_plans:view` permission globally. It does **not** check if the user should have access to the specific plan for this date. There is no row-level authorization — any user with the permission can see any date's plan.

**Fix:** Implement date-range limits (see Finding 1 fix) or add department scoping to the plan query.

---

### Finding 5 — Template Plan Data Exposure (MEDIUM)

**File:** `src/app/api/daily-plans/[date]/route.ts:76-84`
**Severity:** MEDIUM
**CWE:** CWE-200

**Problem:**
When no plan exists for today, the system optionally loads the last working day's plan as a template:

```ts
// route.ts:76-84
if (!plan && autoCarryOver) {
  const lastWorkingDay = findLastWorkingDay(date, weekendMode);
  const templatePlan = await loadPlan(lastWorkingDay);
  if (templatePlan) {
    plan = templatePlan;
    isTemplate = true;
  }
}
```

The template plan is fully loaded (including all site assignments with employee names/numbers) but only `isTemplate: true` flag is returned to indicate it. The client receives the actual template plan's data in `sites`. A GEWERBLICH user would see the last working day's full plan data — potentially for a different department — as a "template" with no indication whose plan it was.

**Fix:**
Do not return template plan data in the response when `isTemplate = true`. Only return `isTemplate: true` and empty `sites` to let the client initialize a blank plan.

---

### Finding 6 — WorkSite Auto-Upsert Privilege Escalation (MEDIUM)

**File:** `src/app/api/daily-plans/[date]/route.ts:194-212`
**Severity:** MEDIUM
**CWE:** CWE-269 (Privilege Escalation)

**Problem:**
A user with only `daily_plans:edit` (GEWERBLICH) can create/update WorkSite records through the daily plan save operation:

```ts
// route.ts:194-212 — no separate WorkSite permission check
await prisma.workSite.upsert({
  where: { name_location: { name: s.name, location: s.location ?? '' } },
  create: { name: s.name, location: s.location ?? null, /* ... */ },
  update: { lastUsedAt: new Date(), /* ... */ },
});
```

The WorkSite CRUD endpoint requires `daily_plans:manage_sites` (see `src/app/api/work-sites/[id]/route.ts:11`), but the daily plan route bypasses this and upserts WorkSites directly.

**Fix:**
Either require `daily_plans:manage_sites` for the upsert operation, or remove the auto-upsert and require explicit WorkSite creation through the proper API.

---

### Finding 7 — Action Mapping Bug on PUT (MEDIUM)

**File:** `src/app/api/daily-plans/[date]/route.ts:144`
**Severity:** MEDIUM
**CWE:** CWE-939 (Improper Authorization)

**Problem:**
The `requirePermission` wrapper maps HTTP method to action:
```ts
// rbac.ts:144 — method === 'GET' ? 'view' : 'create'
const action = actionOverride || (method === 'GET' ? 'view' : 'create');
```

For PUT requests, `actionOverride` is `'edit'` (line 135: `requirePermission(request, 'daily_plans', 'edit')`), so this works correctly. However, the comment in `rbac.ts` line 144 says `'create'` for non-GET, which is misleading. The `requirePermission` call does pass `'edit'`, but if a developer removes the override, the fallback would incorrectly use `'create'` instead of `'edit'` for PUT requests.

**Fix:**
In `rbac.ts`, change the fallback to properly map PUT to `'edit'`:
```ts
const action = actionOverride || (
  method === 'GET' ? 'view' :
  method === 'PUT' ? 'edit' :
  method === 'DELETE' ? 'delete' :
  'create'
);
```

---

### Finding 8 — No Employee-Level Authorization (MEDIUM)

**File:** `src/app/api/daily-plans/[date]/route.ts:183-191`
**Severity:** MEDIUM
**CWE:** CWE-285

**Problem:**
When saving assignments, there is no check whether the authenticated user is authorized to assign specific employees:

```ts
// route.ts:183-191 — no employee-level authorization
await prisma.dailyPlanAssignment.createMany({
  data: s.assignments.map((a) => ({
    siteId: site.id,
    employeeId: a.employeeId,
    note: a.note ?? null,
  })),
  skipDuplicates: true,
});
```

If `poolDepartmentIds` is set, employees outside that pool won't appear in the UI pool, but the API accepts any `employeeId` in the write payload without validating it belongs to an authorized department.

**Fix:**
Validate that all `employeeId` values in the write request belong to `poolDepartmentIds` (if set) or are otherwise authorized for the current user.

---

### Finding 9 — Missing Date Format Validation (LOW)

**File:** `src/app/api/daily-plans/[date]/route.ts:8-12`
**Severity:** LOW
**CWE:** CWE-20 (Improper Input Validation)

**Problem:**
`parseDate` accepts any `YYYY-MM-DD` string without validation:
```ts
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
```
Malformed inputs like `2025-99-99` produce an invalid Date. Empty strings split to `['', undefined, undefined]` causing NaN.

**Fix:**
```ts
function parseDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(date.getTime())) return null;
  return date;
}
```
And add null check after parseDate call.

---

### Finding 10 — Missing Input Validation on Site Fields (LOW)

**File:** `src/app/api/daily-plans/[date]/route.ts:143-155`
**Severity:** LOW
**CWE:** CWE-20

**Problem:**
The write handler accepts any structure for `sites` array without validation:
```ts
const { sites = [] } = body as { sites: Array<{...}> };
```
No checks on: `s.name` length, `s.location` length, `s.vehiclePlates` is array, `s.startTime`/`s.endTime` format, `s.assignments` structure.

**Fix:**
Add validation schema:
```ts
if (!Array.isArray(sites)) return NextResponse.json({ error: 'Invalid sites' }, { status: 400 });
for (const s of sites) {
  if (!s.name || typeof s.name !== 'string' || s.name.length > 200) return NextResponse.json({ error: 'Invalid site name' }, { status: 400 });
  if (!Array.isArray(s.vehiclePlates)) return NextResponse.json({ error: 'Invalid vehiclePlates' }, { status: 400 });
  // etc.
}
```

---

### Finding 11 — No Date Range Limits (LOW)

**File:** `src/app/api/daily-plans/[date]/route.ts:44-128`
**Severity:** LOW

**Problem:**
Users can access plans for any date (e.g., year 1900 or year 3000) with no range restrictions.

**Fix:** Implement ±30 day range check (see Finding 1 fix example).

---

### Finding 12 — Settings Access for GEWERBLICH (MEDIUM)

**File:** `src/app/api/settings/planning/route.ts:37-39`
**Severity:** MEDIUM
**CWE:** CWE-285

**Problem:**
The planning settings PUT requires `settings:edit_planning`:
```ts
const authResult = await requirePermission(request, 'settings', 'edit_planning');
```
GEWERBLICH has `daily_plans:edit` but no `settings` permissions. However, if an ADMIN accidentally grants `settings:edit_planning` to GEWERBLICH, they can modify `planning_pool_departments` and other settings. The `planning_pool_departments` filter is central to the security boundary here — modifying it could expose or hide employee data.

**Fix:**
Keep `settings:edit_planning` restricted to ADMIN only. Ensure the seed data does not grant this permission to non-ADMIN roles. Add an explicit admin-only guard in the settings route for pool department changes.

---

### Finding 13 — Client-Side `isAdmin` Bypassable (MEDIUM)

**File:** `src/app/[locale]/planning/[date]/page.tsx:125`
**Severity:** MEDIUM
**CWE:** CWE-939

**Problem:**
```ts
const isAdmin = session?.user?.role === 'ADMIN';
```
This client-side check is cosmetic for UI rendering. API requests use the server-side `requirePermission`. However, the client uses `isAdmin` to conditionally render controls (e.g., admin-only buttons). A manipulated client response could reveal UI elements intended only for admins.

**Fix:**
Server-side already enforces permissions. For UI, rely on server-provided navigation permissions (`getAccessibleNav`) rather than client-side role check. Consider removing `isAdmin` usage for critical UI decisions.

---

### Finding 14 — Absence Creation Without Employee Authorization (MEDIUM)

**File:** `src/app/[locale]/planning/[date]/page.tsx:571-600`
**Severity:** MEDIUM
**CWE:** CWE-285

**Problem:**
The `createAbsenceDirectly` function (line 571) sends a request to create a vacation for any `employee.id` without verifying the current user is authorized to create absences for that specific employee:

```ts
// page.tsx:571-582
const res = await fetch('/api/vacations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    employeeId: employee.id,  // ← no authorization check
    startDate, endDate,
    vacationType: type,
  }),
});
```

The server-side `/api/vacations/route.ts` should validate that GEWERBLICH users can only create vacations for themselves (or employees they manage). If the vacation API lacks this check, this is an authorization bypass.

**Fix:**
Server-side vacation route must enforce: GEWERBLICH can only create `view_own` vacations for their own `user.employeeId`. Verify `/api/vacations/route.ts` POST handler has this check.

---

## Security Controls Assessment

| Control | Status |
|---------|--------|
| Authentication | ✅ Present — `requireAuth` via NextAuth |
| Authorization (module-level) | ✅ Present — `requirePermission` checks `daily_plans:view/edit` |
| Authorization (row-level) | ❌ Missing — no department/owner scoping on plans or absences |
| poolDepartments filter | ⚠️ Partial — filters employee pool, not absences |
| Input validation | ❌ Missing — no schema validation on write payload |
| IDOR protection | ❌ Missing — date parameter not range-limited |
| Sensitive data exposure | ❌ Found — all absences returned regardless of department |
| Template plan data | ⚠️ Risk — full template plan loaded and sent to client |
| WorkSite upsert | ⚠️ Bypass — can create WorkSites without `manage_sites` permission |

---

## Recommended Priority Fixes

1. **(HIGH) Fix Finding 2/3** — Apply `poolDepartmentIds` filter to absences query
2. **(HIGH) Fix Finding 1** — Add date range limits (±30 days) or row-level department scoping
3. **(MEDIUM) Fix Finding 5** — Do not return template plan data in response
4. **(MEDIUM) Fix Finding 6** — Require `manage_sites` permission for WorkSite upsert
5. **(MEDIUM) Fix Finding 8** — Validate employeeId belongs to authorized department on write
6. **(LOW) Fix Finding 9/10** — Add parseDate validation and site field validation