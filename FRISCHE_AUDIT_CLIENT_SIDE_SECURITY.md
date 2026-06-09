# FRISCHE Audit Report: Client-Side Security & UI-Layer Vulnerabilities
**Date:** 2026-06-08
**System:** HR-Management-System (`/root/hr-management-system`)
**Audit Type:** Client-Side Security / UI-Layer / Authorization Gaps

---

## Executive Summary

The application uses Next.js App Router with middleware-level authentication enforcement, which provides a reasonable baseline. However, there are several client-side authorization gaps and UI-layer vulnerabilities that could allow privilege escalation or information disclosure.

---

## Finding 1: Client-Side Navigation Without Server-Side Auth Check (MEDIUM)

### Status: ✅ MITIGATED — Middleware properly covers page routes

The application uses `'use client'` pages (19 pages total) that rely on `useSession()` for role checks in the UI layer. However, **the middleware protects all page routes** at the edge level:

```typescript
// src/middleware.ts
// Protects ALL non-public routes before client rendering
if (!req.auth) {
  return NextResponse.redirect(loginUrl);
}
if (req.auth.user.role === 'USER') {
  const isPlanningRoute = pathname.match(/^\/[a-z]{2}\/(planning|calendar)(\/|$)/);
  if (!isPlanningRoute) return NextResponse.redirect('/de/planning');
}
```

The middleware correctly enforces:
- Unauthenticated → redirect to `/login`
- `USER` role → only `/de/planning` and `/de/calendar` accessible
- `ADMIN` role → all routes accessible

**Verdict:** No vulnerability here. The middleware is comprehensive.

---

## Finding 2: Sensitive Data in URL Parameters (LOW-MEDIUM)

### Affected Files:
- `src/app/[locale]/employees/[id]/page.tsx` — `?edit=true`, `?tab=`, `?expandDoc=`
- `src/app/[locale]/employees/page.tsx` — `?edit=true` in router.push
- `src/app/[locale]/page.tsx` — `?tab=documents&expandDoc=${doc.id}`

### Issue:
URL parameters are used to control UI state and trigger edit modes. While these are not inherently sensitive, `expandDoc` exposes internal document IDs in the URL:

```typescript
// page.tsx:182
href={`/${locale}/employees/${doc.employee.id}?tab=documents&expandDoc=${doc.id}`}

// employees/[id]/page.tsx:196-220
if (searchParams.get('edit') === 'true' && employee) { startEditing(); }
const expandDoc = searchParams.get('expandDoc');
if (expandDoc) { setExpandedDocIds((prev) => { next.add(expandDoc); }); fetchVersionHistory(expandDoc); }
```

**Risk:** Internal IDs (document, employee) appear in server access logs and browser history. This is an **information disclosure** concern rather than a direct vulnerability.

**Recommendation:** Consider using POST-based actions or encrypted/encoded query parameters for sensitive state changes.

---

## Finding 3: localStorage/sessionStorage with Non-Sensitive User Preferences (LOW)

### Affected Files:
- `src/app/[locale]/employees/page.tsx` — `employees-view-mode` (list/card view)
- `src/components/templates/TemplateEditorModal.tsx` — `template-editor-autosave`

### Details:

```typescript
// employees/page.tsx:47-56
useEffect(() => {
  const stored = localStorage.getItem('employees-view-mode') as ViewMode | null;
  if (stored === 'card' || stored === 'list') setViewMode(stored);
}, []);
const toggleViewMode = (mode: ViewMode) => {
  setViewMode(mode);
  localStorage.setItem('employees-view-mode', mode);
};

// TemplateEditorModal.tsx:115-118
const [autosave, setAutosave] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('template-editor-autosave') === 'true';
});
localStorage.setItem('template-editor-autosave', String(enabled));
```

**Verdict:** ✅ **No vulnerability.** Data stored is purely UI preferences (view mode, autosave toggle). No tokens, PII, or sensitive IDs are stored.

---

## Finding 4: Exposed API Error Details in UI (MEDIUM-HIGH)

### Affected Files:
- `src/components/documents/UploadDocumentModal.tsx:185`
- `src/components/documents/EditDocumentModal.tsx:121`

### Issue:
Error messages from failed API calls are displayed directly to users via `alert()`:

```typescript
// UploadDocumentModal.tsx:183-185
} catch (error) {
  console.error('Error uploading document:', error);
  alert('Fehler beim Hochladen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
}

// EditDocumentModal.tsx:119-121
} catch (error) {
  console.error('Error updating document:', error);
  alert('Fehler beim Speichern: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
}
```

**Risk:** While these specific catch blocks handle generic errors, if the API returns structured error objects with internal details (stack traces, DB errors, field names), those could be exposed via the `error.message` property. The pattern of passing raw error messages to `alert()` is dangerous in general.

**Recommendation:** Replace with user-friendly, sanitized error messages. Never pass raw error objects to user-facing UI.

---

## Finding 5: Admin-Pages UI-Layer Only Protection (CRITICAL — BUT MITIGATED)

### Critical Finding: All Settings Sub-Pages Are Client-Only Protected

**Every single settings sub-page is `'use client'` with NO server-side auth check:**

| Page | File | Has Server Auth? | API Backend Protected? |
|------|------|-----------------|----------------------|
| departments | `settings/departments/page.tsx` | ❌ No | ✅ Yes (`requireAdmin`) |
| categories | `settings/categories/page.tsx` | ❌ No | ✅ Yes |
| templates | `settings/templates/page.tsx` | ❌ No | ✅ Yes |
| planning | `settings/planning/page.tsx` | ❌ No | ✅ Yes (`requireAdmin`) |
| qualification-types | `settings/qualification-types/page.tsx` | ❌ No | Unknown |
| pay-grades | `settings/pay-grades/page.tsx` | ❌ No | ✅ Yes (`requireAdmin`) |
| audit-log | `settings/audit-log/page.tsx` | ❌ No | ✅ Yes (`requireAdmin`) |
| work-sites | `settings/work-sites/page.tsx` | ❌ No | Unknown |

### Example — Audit Log Page (`settings/audit-log/page.tsx`):
```typescript
'use client';
// No useSession, no role check, no server-side guard
// Relies entirely on API-level protection
const fetchLogs = async () => {
  const response = await fetch('/api/audit-log');  // API will reject non-admin
  const data = await response.json();
  setLogs(data.logs || []);
};
```

### Why This Is Mitigated But Still A Problem

The **API routes** use `requireAdmin()` from `@/lib/rbac.ts`, so a `USER` role making API calls will get `403 Forbidden`. However:

1. **Network noise / Enumeration:** A USER can attempt API calls to admin endpoints, receiving 403 responses. This allows them to enumerate what's admin-only and what's not.
2. **UI exposure:** The sidebar navigation hides admin items from USER role, but a USER who manually navigates to `/de/settings/audit-log` will see the page structure (React renders, then API fails). The page loads, shows a blank/error state, which reveals the page exists.
3. **Timing attacks:** Differences in response times or error messages between 401/403 and 404 could reveal information.

### The Sidebar Correctly Filters for USER Role:
```typescript
// Sidebar.tsx:88-92
const isUser = session?.user?.role === 'USER';
const navigation = isUser
  ? allNavigation.filter((item) => item.name === 'planning' || item.name === 'calendar')
  : allNavigation;
```

### Recommendation:
Add server-side protection to all admin settings pages using `getServerSession` or `auth()` in the page components, or at minimum add `useSession` checks in each page to show a proper 403 error rather than allowing the page to render and fail API calls.

---

## Finding 6: Session Cookie Configuration (LOW)

### File: `src/lib/auth.ts:14-18`
```typescript
cookies: {
  sessionToken: {
    name: 'authjs.session-token',
    options: { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
  },
},
```

**Issue:** `secure: false` means the session cookie can be transmitted over non-HTTPS connections in production. This should be `secure: true` for production environments.

**Note:** This may be intentional for local development. Verify in production configuration.

---

## Finding 7: WooCommerce Import Page — No Client-Side Role Check (MEDIUM — MITIGATED)

### File: `src/app/[locale]/clothing/woocommerce-import/page.tsx`

```typescript
'use client';
// No useSession, no role check at UI level
const handleImport = async () => {
  const response = await fetch('/api/woocommerce/import-orders', {...});
  // API route uses requireAdmin(), so non-admin gets 403
};
```

**Mitigation:** API route `src/app/api/woocommerce/import-orders/route.ts` uses `requireAdmin()`.

**Remaining risk:** Same as Finding 5 — USER can navigate to the page, see the UI, trigger API calls, and receive 403 responses.

---

## Finding 8: Error Logging via console.error (INFORMATIONAL)

### Pattern Found:
50+ instances of `console.error()` throughout the codebase for error logging in both client components and API routes.

**Examples:**
- API routes: `console.error('Error fetching employees:', error);`
- Client components: `console.error('Error fetching categories:', error);`

**Risk:** `console.error` in browser DevTools could expose error details to users who inspect the console. This is low severity but worth noting.

---

## Findings Summary Table

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Client-side routing without server-side auth | Medium | ✅ Mitigated by middleware |
| 2 | Sensitive data in URL parameters | Low-Medium | ⚠️ Present (IDs in logs) |
| 3 | localStorage with sensitive data | Low | ✅ No sensitive data stored |
| 4 | Exposed API error details in UI | Medium-High | ⚠️ `alert()` with raw error messages |
| 5 | Admin pages UI-layer only protection | Critical | ⚠️ Mitigated by API-level guards, but enumerable |
| 6 | Session cookie `secure: false` | Low | ⚠️ Dev config, verify for prod |
| 7 | WooCommerce import page no client role check | Medium | ⚠️ Mitigated by API requireAdmin |
| 8 | console.error error leakage | Informational | ⚠️ Browser console exposure |

---

## Recommendations (Priority Order)

1. **[HIGH]** Replace `alert()` error display with user-friendly, sanitized error components. Never pass raw `error.message` to the UI.
2. **[HIGH]** Add `getServerSession` or `auth()` server-side checks to all admin settings pages to prevent UI enumeration and timing attacks.
3. **[MEDIUM]** Change session cookie `secure: false` to `secure: true` in production configuration.
4. **[MEDIUM]** Encode or POST-encode sensitive state parameters (`edit`, `expandDoc`) to prevent log exposure.
5. **[LOW]** Audit all API error responses to ensure they don't include internal details (stack traces, SQL errors, field names).
6. **[LOW]** Replace `console.error` in client components with a proper error logging service.