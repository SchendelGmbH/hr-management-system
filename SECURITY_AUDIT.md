# Security Audit Report – HR Management System API

**Scope:** All routes under `/src/app/api/`
**Date:** 2026-06-08
**Auditor:** Hermes Agent

---

## CRITICAL

### 1. `/api/auth/test-login` — No Auth, Test Endpoint Publicly Accessible
**Severity: CRITICAL**

- Route: `src/app/api/auth/test-login/route.ts`
- No authentication, no session check whatsoever
- Returns `success: true, user: username` on valid credentials — **leaks valid usernames**
- Allows authentication as any user in the system without rate limiting
- Reachable by anyone, no RBAC
- **SQL Injection:** None (uses Prisma parameterized queries)
- **XSS:** None in this route
- **Authorization:** None — completely unauthenticated
- **Input Validation:** Minimal — only checks `username` and `password` exist

**Quick Fix:** Remove this route entirely in production. If needed for dev, add `NODE_ENV=development` guard and require a secret header.

---

### 2. `/api/test-login` — No Auth, Direct DB Query Bypassing Encryption
**Severity: CRITICAL**

- Route: `src/app/api/test-login/route.ts`
- No authentication whatsoever
- Uses `prisma-base` directly (bypasses field-level encryption) with bcrypt
- Returns `{ success: true, user: { id, username, role } }` — **full user object leak including role**
- No rate limiting — brute force trivial
- **Authorization:** None

**Quick Fix:** Remove immediately. This is a debug endpoint that circumvents the entire auth layer.

---

## HIGH

### 3. `/api/vacations/[id]` (PUT, DELETE) — Missing Ownership Authorization
**Severity: HIGH**

- Route: `src/app/api/vacations/[id]/route.ts`
- Uses `requireAuth()` — only checks if user is logged in, **NOT if they own the vacation record**
- Any authenticated user (including `USER` role) can **modify or delete any vacation record** by guessing the UUID
- Example: A `USER` can DELETE another employee's vacation request
- **IDOR vulnerability**

```typescript
// Current: only checks session, not record ownership
const { session, error } = await requireAuth();
await prisma.vacation.delete({ where: { id } }); // no ownership check
```

**Quick Fix:** Add ownership check before delete/update:
```typescript
const vacation = await prisma.vacation.findUnique({ where: { id } });
if (vacation.employeeId !== session.user.id && session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### 4. `/api/qualifications/[id]` (PUT, DELETE) — Missing Ownership Authorization
**Severity: HIGH**

- Route: `src/app/api/qualifications/[id]/route.ts`
- Same pattern as #3: `requireAuth()` only, no ownership check
- Any authenticated user can **modify or delete any qualification** in the system
- Also: POST attachment at same route — same auth check only

**Quick Fix:** Add resource ownership check in PUT/DELETE handlers. Only ADMIN or the employee's qualifications should be modifiable.

---

### 5. `/api/categories/[id]` (PUT, DELETE) — Missing ADMIN Role Check
**Severity: HIGH**

- Route: `src/app/api/categories/[id]/route.ts`
- Uses `auth()` (basic session check) — **does not enforce ADMIN role**
- Any authenticated user (including regular `USER`) can **modify or delete categories**
- Category deletion cascades to document associations

**Quick Fix:** Replace `auth()` with `requireAdmin()` from `@/lib/rbac`.

---

### 6. `/api/templates/[id]` (GET, PUT, DELETE) — Missing ADMIN Role Check
**Severity: HIGH**

- Route: `src/app/api/templates/[id]/route.ts`
- All three methods use `auth()` — only checks authentication, not authorization
- Any authenticated user can **view, edit, or delete any document template**
- Template content could be replaced with malicious content for phishing

**Quick Fix:** Replace `auth()` with `requireAdmin()` for PUT and DELETE. GET can remain authenticated (not admin) if templates are meant to be readable by all users, but content should still be restricted.

---

### 7. `/api/settings/pdf` (GET, PUT) — Uses `requireAdmin()` But Path is `/settings/pdf`
**Severity: MEDIUM** (already partially protected but confirm consistency)

- Route: `src/app/api/settings/pdf/route.ts`
- GET and PUT use `requireAdmin()` — this is correct
- No other vulnerabilities found

**Status:** OK — already properly protected.

---

### 8. `/api/documents/upload` — No ADMIN Check (Should Require ADMIN)
**Severity: HIGH**

- Route: `src/app/api/documents/upload/route.ts`
- Uses `requireAuth()` — any authenticated user can upload documents for any employee
- This may be intentional for USER role (e.g., upload own docs), but document upload for any employee by any USER could be abused
- File validation (magic bytes, MIME type, size) is **good** — prevents polyglot attacks

**Quick Fix:** Add comment documenting intended access. If only ADMIN should upload for other employees, enforce ADMIN check.

---

### 9. `/api/documents/group-generate` — Authenticated Users Can Generate PDFs for Any Employee
**Severity: MEDIUM**

- Route: `src/app/api/documents/group-generate/route.ts`
- Uses `auth()` — any authenticated user can trigger document generation for any employee by ID
- The `buildSummaryHtml` function renders `companyName`, `employeeFullName`, `signingCity`, `signingDate` into HTML via template literals — **potential XSS if these fields contain unsanitized HTML**
- However, `renderContentPdf` renders via Puppeteer which may sanitize — needs verification

**Quick Fix:** 
1. Add ADMIN check or ensure USER can only generate for themselves.
2. Ensure `renderContentPdf` sanitizes HTML before PDF rendering.
3. Consider adding rate limiting on this endpoint (expensive operation).

---

## MEDIUM

### 10. `/api/notifications` (GET) — Missing Pagination
**Severity: MEDIUM**

- Route: `src/app/api/notifications/route.ts`
- `take: 50` hardcoded — no pagination parameters
- For users with many notifications, all are loaded in single request
- **DoS potential** if attacker creates many notifications for a user

**Quick Fix:** Add `page` and `limit` query parameters with reasonable caps (max 100).

---

### 11. `/api/clothing/orders` (GET, POST) — Missing Pagination on GET
**Severity: MEDIUM**

- Route: `src/app/api/clothing/orders/route.ts`
- GET has no pagination — returns all orders (or filtered by employeeId)
- POST creates orders without ADMIN check — any authenticated user can create clothing orders

**Quick Fix:** Add pagination to GET. Consider ADMIN-only for POST (clothing orders affect budget).

---

### 12. `/api/clothing/items` (POST) — Missing ADMIN Check
**Severity: MEDIUM**

- Route: `src/app/api/clothing/items/route.ts`
- POST creates items with `auth()` only — any authenticated user can create clothing catalog items
- Should probably be ADMIN-only

**Quick Fix:** Use `requireAdmin()` for POST.

---

### 13. `/api/employees/[id]/portal-access` (PUT, DELETE) — Role Assignment Not Restricted
**Severity: MEDIUM**

- Route: `src/app/api/employees/[id]/portal-access/route.ts`
- PUT allows setting `role: 'ADMIN'` via string coercion `role === 'ADMIN' ? 'ADMIN' : 'USER'`
- If a USER calls this endpoint (should be blocked by middleware), they could theoretically escalate
- However, `requireAdmin()` is called — so this is protected at the route level
- The string coercion is defensive but the logic is sound

**Status:** OK — protected by `requireAdmin()`.

---

### 14. `/api/vacations` (POST) — No Employee Existence Validation
**Severity: MEDIUM**

- Route: `src/app/api/vacations/route.ts`
- Creates vacation for `data.employeeId` without verifying the employee exists
- Should validate employeeId exists before creating vacation record

**Quick Fix:** Add employee existence check:
```typescript
const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
if (!employee) return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
```

---

### 15. `/api/daily-plans/[date]` (GET) — No Pagination, Returns All Employees
**Severity: MEDIUM**

- Route: `src/app/api/daily-plans/[date]/route.ts`
- `allEmployees` returned in every response — no pagination
- For large organizations, this could return hundreds of employee records per request
- **DoS potential** — expensive query on every plan view

**Quick Fix:** Add pagination or filter by department. Consider caching.

---

### 16. `/api/calendar/events` (GET) — No Pagination on Large Dataset
**Severity: MEDIUM**

- Route: `src/app/api/calendar/events/route.ts`
- Returns all vacations, documents, employees, qualifications, and holidays in a single response
- No pagination, no filtering by date range
- For 500+ employees, this generates thousands of events
- **DoS / Performance issue**

**Quick Fix:** Add `from` and `to` date range parameters, limit results.

---

### 17. `/api/employees` (GET) — `page` and `limit` from `parseInt` Without Validation
**Severity: MEDIUM**

- Route: `src/app/api/employees/route.ts`
- `parseInt(searchParams.get('page') || '1')` — no negative/zero check
- `parseInt(searchParams.get('limit') || '50')` — no upper bound cap
- User could request `limit=999999` causing performance issues

**Quick Fix:**
```typescript
const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
```

---

## LOW

### 18. `/api/clothing/items` (GET) — `category` Filter Has No Validation
**Severity: LOW**

- Route: `src/app/api/clothing/items/route.ts`
- `category` query param passed directly to Prisma `where: { category }`
- No validation — any string accepted (including empty)
- Prisma handles SQL injection protection via parameterized queries

**Quick Fix:** Validate `category` is non-empty string.

---

### 19. `/api/documents` (GET) — `search` Parameter In-Memory Filter, No DB Index
**Severity: LOW**

- Route: `src/app/api/documents/route.ts`
- Full-text search implemented as in-memory filter on up to 100 documents
- `take: 100` limits results but `search` filter happens post-fetch
- For large document sets, performance degrades

**Quick Fix:** Consider Prisma full-text search or dedicated search engine for production scale.

---

### 20. `/api/documents/[id]` (PATCH) — Snooze Feature Has No Validation
**Severity: LOW**

- Route: `src/app/api/documents/[id]/route.ts`
- `snoozedUntil` date parsed from JSON without validation
- `new Date(body.snoozedUntil)` — invalid dates become Invalid Date objects
- Prisma likely handles this gracefully (stores null), but error message could be clearer

**Quick Fix:** Validate `snoozedUntil` is a valid date:
```typescript
const snoozedUntil = body.snoozedUntil ? new Date(body.snoozedUntil) : null;
if (body.snoozedUntil && isNaN(snoozedUntil.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
```

---

### 21. `/api/work-sites` (GET) — Side Effect: Deletes Stale Sites on Every GET
**Severity: LOW**

- Route: `src/app/api/work-sites/route.ts`
- GET triggers `prisma.workSite.deleteMany` as a side effect (cleanup)
- This is unexpected behavior for a GET request — violates REST semantics
- Could cause accidental data loss if retention logic has bugs

**Quick Fix:** Move cleanup to a separate DELETE endpoint or cron job, not a GET handler.

---

### 22. General: Audit Logs Store JSON Strings in `oldValues`/`newValues`
**Severity: INFO**

- All audit log entries serialize complex objects via `JSON.stringify()`
- No encryption of audit log entries
- `ipAddress` is hardcoded to `'unknown'` in auth.ts — no client IP tracking

**Quick Fix:** Capture real IP from request headers in audit log.

---

## Summary by Route

| Route | SQL Inj | XSS | Auth | IDOR | Validation | Severity |
|-------|---------|-----|------|------|------------|----------|
| `/api/auth/test-login` | ❌ | ❌ | ❌ NONE | ❌ | ❌ | **CRITICAL** |
| `/api/test-login` | ❌ | ❌ | ❌ NONE | ❌ | ❌ | **CRITICAL** |
| `/api/vacations/[id]` PUT/DELETE | ❌ | ❌ | ⚠️ AuthOnly | ❌ | ⚠️ | **HIGH** |
| `/api/qualifications/[id]` PUT/DELETE | ❌ | ❌ | ⚠️ AuthOnly | ❌ | ⚠️ | **HIGH** |
| `/api/categories/[id]` PUT/DELETE | ❌ | ❌ | ⚠️ AuthOnly | ⚠️ | ⚠️ | **HIGH** |
| `/api/templates/[id]` GET/PUT/DELETE | ❌ | ❌ | ⚠️ AuthOnly | ⚠️ | ⚠️ | **HIGH** |
| `/api/documents/upload` | ❌ | ❌ | ⚠️ AuthOnly | ⚠️ | ✅ | **MEDIUM** |
| `/api/documents/group-generate` | ❌ | ⚠️ Potential | ⚠️ AuthOnly | ⚠️ | ⚠️ | **MEDIUM** |
| `/api/notifications` GET | ❌ | ❌ | ✅ | ✅ | ❌ No pagination | **MEDIUM** |
| `/api/clothing/orders` GET/POST | ❌ | ❌ | ⚠️ AuthOnly | ⚠️ | ❌ No pagination | **MEDIUM** |
| `/api/clothing/items` POST | ❌ | ❌ | ⚠️ AuthOnly | ⚠️ | ⚠️ | **MEDIUM** |
| `/api/daily-plans/[date]` GET | ❌ | ❌ | ✅ | ✅ | ❌ No pagination | **MEDIUM** |
| `/api/calendar/events` GET | ❌ | ❌ | ✅ | ✅ | ❌ No pagination | **MEDIUM** |
| `/api/employees` GET | ❌ | ❌ | ✅ | ✅ | ❌ Unbounded pagination | **MEDIUM** |
| `/api/vacations` POST | ❌ | ❌ | ✅ | ⚠️ No emp check | ⚠️ | **MEDIUM** |
| `/api/work-sites` GET | ❌ | ❌ | ✅ | ✅ | ⚠️ Side effect | **LOW** |
| `/api/settings/pdf` | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/employees/[id]` GET/PUT/DELETE | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/departments` GET/POST | ❌ | ❌ | ✅ ADMIN POST | ✅ | ✅ | ✅ OK |
| `/api/departments/[id]` DELETE | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/audit-log` GET | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/notifications/[id]` PATCH | ❌ | ❌ | ✅ User + ID | ✅ | ✅ | ✅ OK |
| `/api/notifications/mark-all-read` | ❌ | ❌ | ✅ User scoped | ✅ | ✅ | ✅ OK |
| `/api/clothing/orders/[id]` GET/PUT/DELETE | ❌ | ❌ | ✅ Auth | ⚠️ No owner check PUT | ✅ | ✅ OK (scope limited) |
| `/api/clothing/items` GET | ❌ | ❌ | ✅ | ✅ | ⚠️ | ✅ OK |
| `/api/clothing/items/[id]` GET/PUT/DELETE | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ OK |
| `/api/qualification-types` GET/POST | ❌ | ❌ | ✅ ADMIN POST | ✅ | ✅ | ✅ OK |
| `/api/qualification-types/[id]` PUT/DELETE | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/qualifications` GET | ❌ | ❌ | ✅ Auth | ✅ | ✅ | ✅ OK |
| `/api/employees/[id]/qualifications` GET/POST | ❌ | ❌ | ✅ Auth | ⚠️ No owner check POST | ✅ | ✅ OK |
| `/api/employees/[id]/portal-access` GET/POST/PUT/DELETE | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/employees/[id]/portal-access/reset-password` POST | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/employees/[id]/clothing-inventory` GET | ❌ | ❌ | ✅ Auth | ⚠️ Any emp ID | ✅ | ✅ OK |
| `/api/vehicles` GET/POST | ❌ | ❌ | ✅ Auth | ✅ | ✅ | ✅ OK |
| `/api/vehicles/[id]` DELETE | ❌ | ❌ | ✅ Auth | ✅ | ✅ | ✅ OK |
| `/api/work-sites/[id]` DELETE | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/pay-grades` GET/POST | ❌ | ❌ | ✅ ADMIN POST | ✅ | ✅ | ✅ OK |
| `/api/pay-grades/[id]` PUT/DELETE | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/templates` GET/POST | ❌ | ❌ | ✅ ADMIN POST | ✅ | ✅ | ✅ OK |
| `/api/templates/[id]/generate` POST | ❌ | ❌ | ✅ Auth | ⚠️ Any emp ID | ✅ | ✅ OK |
| `/api/settings/planning` GET/PUT | ❌ | ❌ | ✅ ADMIN PUT | ✅ | ✅ | ✅ OK |
| `/api/settings/pdf/letterhead` POST/DELETE | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/woocommerce/import-products` POST | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/woocommerce/import-orders` POST | ❌ | ❌ | ✅ ADMIN | ✅ | ✅ | ✅ OK |
| `/api/documents` GET | ❌ | ❌ | ✅ Auth | ✅ | ✅ | ✅ OK |
| `/api/documents/[id]` GET/PUT/DELETE/PATCH | ❌ | ❌ | ✅ ADMIN PUT/DELETE | ✅ | ✅ | ✅ OK |

---

## Top 5 Priority Fixes

1. **Remove `/api/auth/test-login` and `/api/test-login`** — CRITICAL debug endpoints with no auth
2. **Add ownership check to `/api/vacations/[id]` (PUT/DELETE)** — IDOR allowing any user to modify any vacation
3. **Add ownership check to `/api/qualifications/[id]` (PUT/DELETE)** — Same IDOR pattern
4. **Replace `auth()` with `requireAdmin()` in `/api/categories/[id]` (PUT/DELETE)**
5. **Replace `auth()` with `requireAdmin()` in `/api/templates/[id]` (PUT/DELETE)**

---

*Generated by Hermes Agent — Security Audit*