import fs from 'node:fs/promises';
import path from 'node:path';
import { newDb } from 'pg-mem';

export async function createTestDb() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  // pg-mem requires registering some functions used by pg
  mem.public.registerFunction({
    name: 'now',
    returns: 'timestamptz' as any,
    implementation: () => new Date()
  });

  const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
  const entries = await fs.readdir(migrationsDir);
  const sqlFiles = entries.filter((e) => e.endsWith('.sql')).sort();
  for (const file of sqlFiles) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    mem.public.none(sql);
  }

  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();
  return { mem, pool };
}
