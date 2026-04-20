import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { logger } from '../logger.js';

const migrationClient = postgres(process.env.DATABASE_URL || 'postgresql://homer:homer@localhost:5432/homer', { max: 1 });
const db = drizzle(migrationClient);

async function runMigrations() {
  logger.info('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  logger.info('Migrations completed');
  await migrationClient.end();
}

runMigrations().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
