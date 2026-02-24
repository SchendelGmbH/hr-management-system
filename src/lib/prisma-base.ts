import { PrismaClient } from '@prisma/client';

// Unverschlüsselter PrismaClient - nur für Auth/User-Tabellen
// (Mitarbeiterdaten werden über src/lib/prisma.ts mit Verschlüsselung abgerufen)

const globalForPrismaBase = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

export const prismaBase =
  globalForPrismaBase.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrismaBase.prismaBase = prismaBase;

export default prismaBase;
