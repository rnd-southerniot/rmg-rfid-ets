import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((e) => e.endsWith('.sql')).sort();

  for (const file of sqlFiles) {
    const full = path.join(migrationsDir, file);
    const sql = await fs.readFile(full, 'utf8');
    // Each migration is idempotent via IF NOT EXISTS.
    await pool.query(sql);
    // eslint-disable-next-line no-console
    console.log(`Applied ${file}`);
  }

  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
