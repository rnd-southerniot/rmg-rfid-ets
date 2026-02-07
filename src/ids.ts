import crypto from 'node:crypto';

export function ulidLike(prefix: string): string {
  // Not a true ULID; sufficient for MVP internal IDs.
  const rnd = crypto.randomBytes(10).toString('hex');
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rnd}`;
}

export function stationToken(): string {
  return `sttok_${crypto.randomBytes(24).toString('base64url')}`;
}

export function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
