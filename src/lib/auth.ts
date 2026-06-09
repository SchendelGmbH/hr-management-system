import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import * as bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma-base';
import { checkLoginRateLimit, resetLoginRateLimit, getRetryAfterSeconds } from '@/lib/rateLimit';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes
  },
  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
    },
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
      async authorize(credentials, request) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0] ||
                   request?.headers?.get('x-real-ip') ||
                   'unknown';

        const identifier = credentials.username as string;

        // Rate-Limit prüfen (max. 5 Versuche / 15 Min)
        if (!await checkLoginRateLimit(identifier)) {
          const retryAfter = await getRetryAfterSeconds(identifier);
          throw new Error(`Too many login attempts. Try again in ${retryAfter} seconds.`);
        }

        // Find user by username or email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: credentials.username as string },
              { email: credentials.username as string },
            ],
            isActive: true,
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
        await resetLoginRateLimit(identifier);

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
            ipAddress: ip,
          },
        });

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? 'USER';
        // Prevent session fixation: flag fresh login so client can regenerate session
        token.justLoggedIn = true;
      }
      // Clear the flag on subsequent calls so session is stable after init
      if (token.justLoggedIn) {
        token.justLoggedIn = undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
