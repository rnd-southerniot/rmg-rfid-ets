import { signJwt } from '../../src/jwt';

// Mirror the test defaults baked into createApp() when jwtSecret/loginRfidUid
// are not provided. Keep in sync with src/app.ts.
export const TEST_JWT_SECRET = 'test-jwt-secret-default-do-not-use-in-prod';
export const TEST_LOGIN_RFID_UID = 'TESTLOGINUID';

export const TEST_USER_TOKEN = signJwt({ sub: TEST_LOGIN_RFID_UID }, TEST_JWT_SECRET);
