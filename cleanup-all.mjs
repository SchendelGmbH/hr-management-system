import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRaw`
    UPDATE role_permissions 
    SET access_level = 'write' 
    WHERE access_level = 'all'
  `;
  console.log(`Migrated ${result} rows from 'all' to 'write'`);
  
  const remaining = await prisma.$queryRawUnsafe<{access_level: string}[]>(
    'SELECT DISTINCT access_level FROM role_permissions'
  );
  console.log('Remaining access levels:', remaining.map(r => r.access_level));
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); });