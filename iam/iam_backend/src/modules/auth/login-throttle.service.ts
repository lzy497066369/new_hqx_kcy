import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000;

type AttemptState = { failures: number; lockedUntil: null | number; windowStartedAt: number };

@Injectable()
export class LoginThrottleService {
  private readonly attempts = new Map<string, AttemptState>();

  assertAllowed(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const state = this.getActiveState(key, now);
      if (state?.lockedUntil && state.lockedUntil > now) {
        throw new HttpException('Too many failed login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  clear(keys: string[]): void {
    keys.forEach((key) => this.attempts.delete(key));
  }

  keys(domain: 'iam-admin' | 'sso', username: string, ip: string): string[] {
    const account = username.trim().toLowerCase();
    const normalizedIp = ip.trim() || 'unknown';
    return [`account:${domain}:${account}`, `ip:${domain}:${normalizedIp}`];
  }

  recordFailure(keys: string[]): void {
    const now = Date.now();
    for (const key of keys) {
      const state = this.getActiveState(key, now) ?? { failures: 0, lockedUntil: null, windowStartedAt: now };
      state.failures += 1;
      if (state.failures >= MAX_FAILURES) state.lockedUntil = now + LOCK_DURATION_MS;
      this.attempts.set(key, state);
    }
  }

  private getActiveState(key: string, now: number): AttemptState | null {
    const state = this.attempts.get(key);
    if (!state) return null;
    if ((state.lockedUntil && state.lockedUntil <= now) || now - state.windowStartedAt > WINDOW_DURATION_MS) {
      this.attempts.delete(key);
      return null;
    }
    return state;
  }
}
