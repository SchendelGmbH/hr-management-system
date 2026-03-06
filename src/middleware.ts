import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth'];

// API routes that USER role is allowed to access (for Tagesplanung)
const userAllowedApiPrefixes = [
  '/api/daily-plans',
  '/api/work-sites',
  '/api/vehicles',
  '/api/vacations',
  '/api/employees',
  '/api/settings/planning',
  '/api/calendar',
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  // Protect all API routes (except /api/auth which is already in publicRoutes)
  if (pathname.startsWith('/api')) {
    if (!req.auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // USER role: only allow planning-related API routes
    if (req.auth.user.role === 'USER') {
      const allowed = userAllowedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // Check if user is authenticated for page routes
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // USER role: only allow /[locale]/planning routes, redirect everything else
  if (req.auth.user.role === 'USER') {
    // Match /<locale>/planning or /<locale>/planning/...
    const isPlanningRoute = pathname.match(/^\/[a-z]{2}\/(planning|calendar)(\/|$)/);
    // Also allow the locale root to redirect properly
    if (!isPlanningRoute) {
      const planningUrl = new URL('/de/planning', req.url);
      return NextResponse.redirect(planningUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
