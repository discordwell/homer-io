import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/api/dist/lib/db/schema/*.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://homer:homer@localhost:5432/homer',
  },
});
