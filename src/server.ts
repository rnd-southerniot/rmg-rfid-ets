import dotenv from 'dotenv';
import { createPgPool } from './db';
import { loadEnv } from './env';
import { createApp } from './app';

dotenv.config();

const env = loadEnv(process.env);
const pool = createPgPool(env.DATABASE_URL);

const app = createApp({
  db: pool,
  logLevel: env.LOG_LEVEL,
  jwtSecret: env.JWT_SECRET,
  loginRfidUid: env.LOGIN_RFID_UID
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on :${env.PORT}`);
});
