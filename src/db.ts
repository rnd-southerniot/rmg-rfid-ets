import { Pool } from 'pg';

export type Db = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
};

export function createPgPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

export function poolFromEnv(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return createPgPool(databaseUrl);
}
