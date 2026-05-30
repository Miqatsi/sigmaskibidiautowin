import 'dotenv/config';
// @ts-ignore — Prisma v7 types require `prisma generate` to resolve; works at runtime
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Singleton pattern to prevent multiple instances during hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new (PrismaClient as any)({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
