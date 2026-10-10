import { randomUUID } from 'crypto';

export function createToken(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export function formatExpiryDate(ttlMinutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() + ttlMinutes);
  return date.toISOString();
}
