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
      
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is missing.");
      }

      const isRemoteDb =
        connectionString.includes('cockroachlabs.cloud') ||
        connectionString.includes('sslmode=') ||
        process.env.NODE_ENV === 'production';

      const pool = new Pool({
        connectionString,
        ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
      });
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

