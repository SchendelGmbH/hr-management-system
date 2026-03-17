import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import * as bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma-base';
import { checkLoginRateLimit, resetLoginRateLimit, getRetryAfterSeconds } from '@/lib/rateLimit';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        remember: { label: 'Remember me', type: 'checkbox' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const identifier = credentials.username as string;

        // Rate-Limit prüfen (max. 5 Versuche / 15 Min)
        if (!checkLoginRateLimit(identifier)) {
          const retryAfter = getRetryAfterSeconds(identifier);
          throw new Error(`Too many login attempts. Try again in ${retryAfter} seconds.`);
        }

        // Find user by username or email with role
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: credentials.username as string },
              { email: credentials.username as string },
            ],
            isActive: true,
          },
          include: {
            roleRef: true, // Include role data
          },
        });

        if (!user) {
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        // Rate-Limit nach erfolgreichem Login zurücksetzen
        resetLoginRateLimit(identifier);

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            ipAddress: 'unknown', // Will be set in API route
          },
        });

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.roleRef?.name || user.role || 'USER', // Use role name from roleRef
          roleId: user.roleRef?.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? 'USER';
        token.roleId = user.roleId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.roleId = token.roleId as string;
      }
      return session;
    },
  },
});

// Helper: Admin-Rechte prüfen
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check if user has ADMIN role
  const isAdmin = session.user.role === 'ADMIN';
  
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden - Admin required' }, { status: 403 });
  }
  
  return null;
}

// Helper: Auth für Server Components
export async function requireAuth() {
  const session = await auth();
  
  if (!session?.user) {
    return null;
  }
  
  // Get full user with employee data and role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      employee: true,
      roleRef: true,
    },
  });
  
  return user;
}
