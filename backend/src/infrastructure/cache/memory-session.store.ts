import { Injectable } from '@nestjs/common';

import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { SessionRecord } from '../../common/interfaces/session-record.interface';
import { createToken, formatExpiryDate } from '../../common/utils/token.util';
import { SessionStore } from '../../modules/auth/session-store.port';

const ACCESS_TOKEN_TTL_MINUTES = 2 * 60;
const REFRESH_TOKEN_TTL_MINUTES = 7 * 24 * 60;

type SessionIndex = {
  refreshToken: string;
  session: SessionRecord;
};

@Injectable()
export class MemorySessionStore implements SessionStore {
  private readonly accessTokenMap = new Map<string, SessionIndex>();
  private readonly refreshTokenMap = new Map<string, SessionIndex>();

  async createSession(user: CurrentUser): Promise<SessionRecord> {
    const session: SessionRecord = {
      accessToken: createToken('atk'),
      createdAt: new Date().toISOString(),
      expiresAt: formatExpiryDate(ACCESS_TOKEN_TTL_MINUTES),
      refreshExpiresAt: formatExpiryDate(REFRESH_TOKEN_TTL_MINUTES),
      refreshToken: createToken('rtk'),
      user,
    };

    const index: SessionIndex = {
      refreshToken: session.refreshToken,
      session,
    };

    this.accessTokenMap.set(session.accessToken, index);
    this.refreshTokenMap.set(session.refreshToken, index);
    return session;
  }

  async findByAccessToken(accessToken: string): Promise<SessionRecord | null> {
    const current = this.accessTokenMap.get(accessToken);
    if (!current) {
      return null;
    }
    if (this.isExpired(current.session.expiresAt)) {
      await this.revokeByAccessToken(accessToken);
      return null;
    }
    return current.session;
  }

  async findByRefreshToken(
    refreshToken: string,
  ): Promise<SessionRecord | null> {
    const current = this.refreshTokenMap.get(refreshToken);
    if (!current) {
      return null;
    }
    if (this.isExpired(current.session.refreshExpiresAt)) {
      await this.revokeByRefreshToken(refreshToken);
      return null;
    }
    return current.session;
  }

  async revokeByAccessToken(accessToken: string): Promise<void> {
    const current = this.accessTokenMap.get(accessToken);
    if (!current) {
      return;
    }

    this.accessTokenMap.delete(accessToken);
    this.refreshTokenMap.delete(current.refreshToken);
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const current = this.refreshTokenMap.get(refreshToken);
    if (!current) {
      return;
    }

    this.refreshTokenMap.delete(refreshToken);
    this.accessTokenMap.delete(current.session.accessToken);
  }

  async rotateSession(refreshToken: string): Promise<SessionRecord | null> {
    const current = await this.findByRefreshToken(refreshToken);
    if (!current) {
      return null;
    }

    await this.revokeByRefreshToken(refreshToken);
    return this.createSession(current.user);
  }

  private isExpired(value: string): boolean {
    return !Number.isFinite(Date.parse(value)) || Date.parse(value) <= Date.now();
  }
}
