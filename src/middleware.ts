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
  '/api/notifications',
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return response;
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)
  ) {
    return response;
  }

  // Protect all API routes (except /api/auth which is already in publicRoutes)
  if (pathname.startsWith('/api')) {
    if (!req.auth || !req.auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // USER role: only allow planning-related API routes
    if (req.auth.user.role === 'USER') {
      const allowed = userAllowedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    return response;
  }

  // Check if user is authenticated for page routes
  if (!req.auth || !req.auth.user) {
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

  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
