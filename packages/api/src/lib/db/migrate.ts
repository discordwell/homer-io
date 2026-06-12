import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { logger } from '../logger.js';

// Refuse to run against a guessed default. Silently falling back to a hardcoded
// localhost URL risks migrating the wrong database; require DATABASE_URL explicitly.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  logger.error('DATABASE_URL is required to run migrations (no localhost fallback). Set it in the environment — in production it lives in /opt/homer-io/.env.');
  process.exit(1);
}

const migrationClient = postgres(databaseUrl, { max: 1 });
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
