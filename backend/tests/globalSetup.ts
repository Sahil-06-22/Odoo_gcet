import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

export default async function setup() {
  const testUrl = process.env.TEST_DATABASE_URL!;
  const dbName = new URL(testUrl).pathname.slice(1);

  // Create the test database if it's missing (connect through the dev database).
  const admin = new PrismaClient({ datasources: { db: { url: process.env.ADMIN_DATABASE_URL! } } });
  try {
    const exists = await admin.$queryRawUnsafe<{ n: number }[]>(`SELECT 1 AS n FROM pg_database WHERE datname = '${dbName}'`);
    if (!exists.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: testUrl } });
}
