# Security & Quality Audit – DOKUMENTE Module

**Audit Date**: 2026-06-10  
**Files Audited**: 9 files across `src/app/api/documents/`, `src/app/[locale]/documents/`, and `src/components/documents/`

---

## Files In Scope

| File | Purpose |
|------|---------|
| `src/app/api/documents/route.ts` | GET – list documents with filters |
| `src/app/api/documents/[id]/route.ts` | GET (versions), PUT (metadata), DELETE, PATCH (snooze) |
| `src/app/api/documents/upload/route.ts` | POST – upload document / new version |
| `src/app/api/documents/group-generate/route.ts` | POST – generate document from templates |
| `src/app/[locale]/documents/page.tsx` | Client page – document list UI |
| `src/app/[locale]/documents/loading.tsx` | Loading skeleton |
| `src/components/documents/UploadDocumentModal.tsx` | Upload form modal |
| `src/components/documents/EditDocumentModal.tsx` | Edit metadata modal |
| `src/components/documents/DeleteDocumentModal.tsx` | Delete confirmation modal |

---

## Findings Summary

| # | Severity | Category | Location |
|---|----------|----------|----------|
| 1 | **HIGH** | Stored XSS | `upload/route.ts:215` |
| 2 | **HIGH** | IDOR | `route.ts:24-26` |
| 3 | **MEDIUM** | IDOR | `[id]/route.ts:14-17` |
| 4 | **LOW** | Path Traversal (partial) | `[id]/route.ts:179-189` |
| 5 | **INFO** | Encryption | All encrypted fields |

---

## Finding 1 – Stored XSS in `fileName`

**File**: `src/app/api/documents/upload/route.ts:215`  
**Severity**: HIGH  

```typescript
// Line 215 – raw file.name stored without sanitization
fileName: file.name,
```

**Description**: The original client-provided filename (`file.name`) is stored verbatim in the `Document.fileName` column. The frontend renders this at `page.tsx:499` as `{display.title}` (also line 214 stores `file.name` into `fileName`).

While `title` is encrypted (`@encrypted`), `fileName` is **not** encrypted (no `@encrypted` directive in schema). If a user uploads a file named `<img src=x onerror=alert(1)>.pdf`, the name is stored as-is, and when rendered in the table without HTML escaping, it executes.

**Fix**:
```typescript
// Sanitize the stored filename to a safe subset
const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
fileName: safeFileName,
```

Also ensure the frontend uses `{display.fileName}` with proper encoding, or use a dedicated display name separate from storage.

---

## Finding 2 – IDOR: Any authenticated user can view all employees' documents

**File**: `src/app/api/documents/route.ts:24-26`  
**Severity**: HIGH  

```typescript
// Lines 24-26
if (employeeId) {
  where.employeeId = employeeId;
}
```

**Description**: The `employeeId` query parameter is used directly to filter documents. Any user with `documents:view` permission can retrieve documents for **any** employee by passing `?employeeId=<target-id>`. There is no check that the session user is ADMIN or is the employee themselves.

This means a non-admin user who is only supposed to see their own documents can enumerate and view all employees' documents.

**Fix**:
```typescript
// H2: IDOR-Schutz – only ADMIN or the employee themselves can view their documents
if (employeeId) {
  if (session.user.roleName !== 'ADMIN' && session.user.employeeId !== employeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  where.employeeId = employeeId;
}
```

Alternatively, if regular users should only see their own documents by default, omit the `employeeId` filter entirely for non-admin sessions.

---

## Finding 3 – IDOR: Document version history leaks to unauthorized users

**File**: `src/app/api/documents/[id]/route.ts:14-17`  
**Severity**: MEDIUM  

```typescript
// Lines 14-17
const authResult = await requirePermission(request, 'documents', 'view');
if (authResult.error) return authResult.error;
// No check that the user owns or is related to this document's employee
```

**Description**: `GET /api/documents/[id]` returns all version history for a document. The only authorization check is `documents:view` permission. Any user with that permission (e.g., a department manager) can access version history of documents belonging to employees outside their scope.

**Fix**:
```typescript
const authResult = await requirePermission(request, 'documents', 'view');
if (authResult.error) return authResult.error;

const { id } = await params;

// Verify user has access to this document's employee
const doc = await prisma.document.findUnique({
  where: { id },
  select: { employeeId: true },
});
if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

const session = authResult.session;
const isAdmin = session.user.roleName === 'ADMIN';
const isOwnEmployee = session.user.employeeId === doc.employeeId;

if (!isAdmin && !isOwnEmployee) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

Same issue applies to PUT, DELETE, PATCH handlers – they all check `documents:edit`, `documents:delete`, `documents:edit` but don't verify the user owns/is related to the specific document.

---

## Finding 4 – Path Traversal: DELETE validation has inverted logic

**File**: `src/app/api/documents/[id]/route.ts:179-189`  
**Severity**: LOW (mitigated by `process.cwd()` isolation)  

```typescript
// Lines 179-189
const normalizedPath = normalize(version.filePath);
const normalizedFull = normalize(join(process.cwd(), 'public', version.filePath));
if (
  (!normalizedPath.startsWith('/uploads/') && !normalizedPath.startsWith('/documents/')) ||
  normalizedPath.includes('..') ||
  (!normalizedFull.startsWith(normalize(join(process.cwd(), 'public', '/uploads/'))) &&
   !normalizedFull.startsWith(normalize(join(process.cwd(), 'public', '/documents/'))))
) {
  return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
}
```

**Issue**: The logic is overly complex and uses OR conditions that may not catch all traversal patterns. The first condition `!normalizedPath.startsWith(...)` combined with the subsequent checks creates a situation where a path like `/uploads/../../../etc/passwd` could potentially bypass the check.

However, since `version.filePath` comes from the database (not user input directly) and is constrained to `uploads/documents/YEAR/MONTH/` during upload, the practical risk is LOW. The DB stores only the relative path constructed server-side at `upload/route.ts:123`.

**Fix** (cleaner approach):
```typescript
const uploadRoot = normalize(join(process.cwd(), 'public', 'uploads', 'documents'));
const fullPath = normalize(join(process.cwd(), 'public', version.filePath));

if (!fullPath.startsWith(uploadRoot) || fullPath.includes('..')) {
  return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
}
```

---

## Finding 5 – Encryption Handling

**Status**: ADEQUATE  

**Observation**: Fields `title`, `description`, `notes`, `textContent` are marked `@encrypted` in the Prisma schema and use `fieldEncryptionExtension()` via `prisma-field-encryption`. All read/write operations go through Prisma which handles encryption/decryption transparently.

`fileName`, `filePath`, `mimeType`, `fileSize` are **not** encrypted – this is intentional as they are metadata needed for file serving.

**Risk**: If `fileName` contains malicious content (Finding 1), it is stored unencrypted and could be served as a static file with the document. However, Next.js static file serving sets `Content-Disposition: inline` or proper MIME types, limiting script execution from PDF files.

---

## Positive Security Observations

| Feature | Status | Notes |
|---------|--------|-------|
| RBAC authorization | ✅ | `requirePermission()` correctly enforced on all endpoints |
| File type allowlist | ✅ | Only PDF, JPG, PNG, DOCX allowed |
| Magic byte validation | ✅ | Additional validation against polyglot files |
| File size limit | ✅ | 10 MB max |
| Path traversal protection | ✅ | Implemented in DELETE handler |
| File name sanitization (on disk) | ✅ | `sanitizedFilename` used for disk storage |
| SQL injection | ✅ | Prisma parameterized queries |
| Audit logging | ✅ | All mutations logged with userId and entityId |
| IDOR on upload | ✅ | `employeeId` check at `upload/route.ts:45` |
| Snooze functionality | ✅ | PATCH protected with `documents:edit` |

---

## Recommendations (Priority Order)

1. **[HIGH] Fix `fileName` stored XSS** – Sanitize before DB write AND encode on render
2. **[HIGH] Fix IDOR on document listing** – Restrict non-admin users to own documents only
3. **[MEDIUM] Fix IDOR on document access** – Add ownership check to `[id]` handlers
4. **[LOW] Clean up path traversal validation** – Simplify the DELETE check logic
5. **[INFO] Consider rate limiting** on `upload` endpoint for DoS protection