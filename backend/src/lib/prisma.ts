import 'dotenv/config';
import { PrismaClient } from '@prisma/client/default';
import { PrismaPg } from '@prisma/adapter-pg';

// Singleton pattern to prevent multiple instances during hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter }) as any;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
