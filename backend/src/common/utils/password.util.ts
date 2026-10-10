import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function isPasswordHash(value: string): boolean {
  return value.startsWith(`${HASH_PREFIX}$`);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedPassword: string,
): Promise<boolean> {
  // 安全修复：移除明文密码兼容逻辑
  // 如果密码未使用哈希格式，拒绝验证
  if (!isPasswordHash(storedPassword)) {
    throw new Error('Legacy password format detected. Password reset required.');
  }

  const [, salt, storedKey] = storedPassword.split('$');
  if (!salt || !storedKey) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(storedKey, 'hex');
  return (
    storedBuffer.length === derivedKey.length &&
    timingSafeEqual(storedBuffer, derivedKey)
  );
}
