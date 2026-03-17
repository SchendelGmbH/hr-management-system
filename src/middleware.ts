import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth', '/api/chat/broadcast'];

// API routes that all authenticated users can access
const publicApiPrefixes = [
  '/api/daily-plans',
  '/api/work-sites',
  '/api/vehicles',
  '/api/vacations',
  '/api/employees',
  '/api/settings/planning',
  '/api/settings/system',
  '/api/calendar',
  '/api/chat',
  '/api/tasks',
  '/api/swaps',
  '/api/modules',
  '/api/user/permissions',
  '/api/user/modules',
  '/api/notifications',
  '/api/clothing',
  '/api/documents',
  '/api/qualifications',
];

// Admin-only routes
const adminOnlyRoutes = ['/admin'];
const adminOnlyApiRoutes = ['/api/admin'];

// Routes that require specific module permissions (checked client-side)
// These are allowed by middleware but blocked by page components if no permission
const moduleRoutes = [
  '/employees',
  '/documents',
  '/clothing',
  '/calendar',
  '/planning',
  '/chat',
  '/tasks',
  '/swaps',
  '/qualifications',
  '/settings',
  '/notifications',
  '/my-schedule',
];

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin status from role name
  const isAdmin = req.auth.user.role === 'ADMIN';

  // Protect all API routes
  if (pathname.startsWith('/api')) {
    // Admin-only API routes
    if (adminOnlyApiRoutes.some((route) => pathname.startsWith(route))) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
      }
      return NextResponse.next();
    }
    
    // All other API routes are allowed for authenticated users
    // (specific permissions are checked in the API handlers)
    return NextResponse.next();
  }

  // Admin-only page routes
  if (adminOnlyRoutes.some((route) => pathname.includes(route))) {
    if (!isAdmin) {
      const planningUrl = new URL('/de/planning', req.url);
      return NextResponse.redirect(planningUrl);
    }
    return NextResponse.next();
  }

  // Extract locale from pathname (e.g., /de/employees -> /employees)
  const localeMatch = pathname.match(/^\/[a-z]{2}(\/|$)/);
  const pathWithoutLocale = localeMatch 
    ? pathname.substring(localeMatch[0].length - 1) 
    : pathname;

  // Check if route is a module route
  const isModuleRoute = moduleRoutes.some((route) => 
    pathWithoutLocale.startsWith(route)
  );

  // Allow all module routes for authenticated users
  // The actual permission check happens in the page component
  if (isModuleRoute) {
    return NextResponse.next();
  }

  // For non-admin users on non-module routes, redirect to planning
  if (!isAdmin) {
    const planningUrl = new URL('/de/planning', req.url);
    return NextResponse.redirect(planningUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
