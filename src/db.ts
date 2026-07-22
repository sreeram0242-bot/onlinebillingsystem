import pkg, { type PrismaClient } from '@prisma/client';
const PrismaClientConstructor = pkg.PrismaClient;
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
const { Pool } = pg;

// Export a proxy or getter so it doesn't execute at module evaluation time in the client
let prismaInstance: PrismaClient;

export const db = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!prismaInstance) {
      const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
      
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);

      prismaInstance =
        globalForPrisma.prisma ||
        new PrismaClientConstructor({
          adapter,
          log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
        });
      if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaInstance;
    }
    return (prismaInstance as any)[prop];
  }
});

