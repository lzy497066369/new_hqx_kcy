import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, keyLength)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, salt, stored] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !stored) {
    const supplied = Buffer.from(password);
    const legacy = Buffer.from(passwordHash);
    return supplied.length === legacy.length && timingSafeEqual(supplied, legacy);
  }
  const derived = (await scrypt(password, salt, keyLength)) as Buffer;
  const storedBuffer = Buffer.from(stored, 'hex');
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}
