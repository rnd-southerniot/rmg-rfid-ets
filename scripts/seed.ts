import 'dotenv/config';
import { poolFromEnv } from '../src/db';
import { ulidLike } from '../src/ids';

async function main() {
  const db = poolFromEnv();

  const factoryCode = process.env.SEED_FACTORY_CODE ?? 'SOUTHERNIOT-DEMO';
  const factoryName = process.env.SEED_FACTORY_NAME ?? factoryCode;
  const lines = (process.env.SEED_LINES ?? 'L1,L2').split(',').map((s) => s.trim()).filter(Boolean);

  // factory
  const f0 = await db.query('SELECT id FROM factories WHERE code = $1 LIMIT 1', [factoryCode]);
  let factoryId = f0.rows[0]?.id as string | undefined;
  if (!factoryId) {
    factoryId = ulidLike('fac');
    await db.query('INSERT INTO factories (id, name, code) VALUES ($1,$2,$3)', [factoryId, factoryName, factoryCode]);
    // eslint-disable-next-line no-console
    console.log('Seeded factory', { factoryCode, factoryId });
  } else {
    // eslint-disable-next-line no-console
    console.log('Factory already exists', { factoryCode, factoryId });
  }

  for (const name of lines) {
    const l0 = await db.query('SELECT id FROM lines WHERE factory_id = $1 AND name = $2 LIMIT 1', [factoryId, name]);
    if (l0.rows.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Line exists', { name, id: l0.rows[0].id });
      continue;
    }

    const id = ulidLike('ln');
    await db.query('INSERT INTO lines (id, factory_id, name) VALUES ($1,$2,$3)', [id, factoryId, name]);
    // eslint-disable-next-line no-console
    console.log('Seeded line', { name, id });
  }

  await db.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
