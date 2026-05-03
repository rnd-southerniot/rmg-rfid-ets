import { createHmac, timingSafeEqual } from 'node:crypto';

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

export type JwtPayload = {
  sub: string;
  iat: number;
  [k: string]: unknown;
};

export function signJwt(payload: Omit<JwtPayload, 'iat'> & Partial<Pick<JwtPayload, 'iat'>>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: JwtPayload = { iat: Math.floor(Date.now() / 1000), ...payload } as JwtPayload;
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(fullPayload));
  const signingInput = `${encHeader}.${encPayload}`;
  const sig = createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${b64url(sig)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;
  const signingInput = `${encHeader}.${encPayload}`;
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  let provided: Buffer;
  try {
    provided = b64urlDecode(encSig);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(encPayload).toString('utf8')) as JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.iat !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
}
