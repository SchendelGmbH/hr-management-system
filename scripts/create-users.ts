/**
 * Einmaliger Script zum Anlegen der System-Benutzer.
 * Ausführen: npx tsx scripts/create-users.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const USERS = [
  {
    username: 'admin',
    email:    'admin@hr-system.local',
    password: 'Admin123!',
    role:     'ADMIN',
  },
  {
    username: 'benutzer',
    email:    'benutzer@hr-system.local',
    password: 'Benutzer123!',
    role:     'USER',
  },
];

async function main() {
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where:  { username: u.username },
      update: { passwordHash: hash, role: u.role, isActive: true },
      create: {
        username:     u.username,
        email:        u.email,
        passwordHash: hash,
        role:         u.role,
        isActive:     true,
      },
    });
    console.log(`✓ ${user.role.padEnd(5)} | ${user.username} | ${u.email} | Passwort: ${u.password}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
