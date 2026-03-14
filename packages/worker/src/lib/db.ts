import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL || 'postgresql://homer:homer@localhost:5432/homer');
export const db = drizzle(client);
