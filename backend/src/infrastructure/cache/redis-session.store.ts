import { Injectable } from '@nestjs/common';

import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { SessionRecord } from '../../common/interfaces/session-record.interface';
import { createToken, formatExpiryDate } from '../../common/utils/token.util';
import { SessionStore } from '../../modules/auth/session-store.port';
import { AuthJwtService } from '../../modules/auth/auth-jwt.service';
import { RedisClientService } from './redis-client.service';
import { randomUUID } from 'node:crypto';

const ACCESS_TOKEN_TTL_MINUTES = 2 * 60;
const REFRESH_TOKEN_TTL_MINUTES = 7 * 24 * 60;
const ACCESS_KEY_PREFIX = 'session:access:';
const REFRESH_KEY_PREFIX = 'session:refresh:';

@Injectable()
export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly redisClient: RedisClientService,
    private readonly jwtService: AuthJwtService,
  ) {}

  async createSession(user: CurrentUser): Promise<SessionRecord> {
    const sessionId = randomUUID();
    const session: SessionRecord = {
      accessToken: '',
      createdAt: new Date().toISOString(),
      expiresAt: formatExpiryDate(ACCESS_TOKEN_TTL_MINUTES),
      refreshExpiresAt: formatExpiryDate(REFRESH_TOKEN_TTL_MINUTES),
      refreshToken: createToken('rtk'),
      sessionId,
      user,
    };
    session.accessToken = this.jwtService.shouldIssue()
      ? this.jwtService.issueAccessToken(user, sessionId)
      : createToken('atk');
    const client = await this.redisClient.getClient();
    const payload = JSON.stringify(session);
    const accessTtlMs = this.ttlMilliseconds(session.expiresAt);
    const refreshTtlMs = this.ttlMilliseconds(session.refreshExpiresAt);
    const pipeline = client.multi();

    pipeline.set(this.accessKey(session.accessToken), payload, 'PX', accessTtlMs);
    pipeline.set(this.refreshKey(session.refreshToken), payload, 'PX', refreshTtlMs);
    const results = await pipeline.exec();
    const commandError = results?.find(([error]) => error)?.[0];
    if (commandError) {
      throw commandError;
    }
    return session;
  }

  async findByAccessToken(accessToken: string): Promise<SessionRecord | null> {
    const client = await this.redisClient.getClient();
    return this.readSession(
      await client.get(this.accessKey(accessToken)),
      accessToken,
      'accessToken',
    );
  }

  async findByRefreshToken(refreshToken: string): Promise<SessionRecord | null> {
    const client = await this.redisClient.getClient();
    return this.readSession(
      await client.get(this.refreshKey(refreshToken)),
      refreshToken,
      'refreshToken',
    );
  }

  async revokeByAccessToken(accessToken: string): Promise<void> {
    const client = await this.redisClient.getClient();
    const session = this.readSession(
      await client.get(this.accessKey(accessToken)),
      accessToken,
      'accessToken',
    );
    if (!session) return;

    await client.del(
      this.accessKey(session.accessToken),
      this.refreshKey(session.refreshToken),
    );
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const client = await this.redisClient.getClient();
    const session = this.readSession(
      await client.get(this.refreshKey(refreshToken)),
      refreshToken,
      'refreshToken',
    );
    if (!session) return;

    await client.del(
      this.accessKey(session.accessToken),
      this.refreshKey(session.refreshToken),
    );
  }

  async rotateSession(refreshToken: string): Promise<SessionRecord | null> {
    const client = await this.redisClient.getClient();
    const session = this.readSession(
      await client.getdel(this.refreshKey(refreshToken)),
      refreshToken,
      'refreshToken',
    );
    if (!session) return null;

    await client.del(this.accessKey(session.accessToken));
    return this.createSession(session.user);
  }

  private accessKey(accessToken: string): string {
    return `${ACCESS_KEY_PREFIX}${accessToken}`;
  }

  private refreshKey(refreshToken: string): string {
    return `${REFRESH_KEY_PREFIX}${refreshToken}`;
  }

  private readSession(
    payload: string | null,
    token: string,
    tokenField: 'accessToken' | 'refreshToken',
  ): SessionRecord | null {
    if (!payload) return null;

    try {
      const session = JSON.parse(payload) as SessionRecord;
      return session[tokenField] === token && session.user ? session : null;
    } catch {
      return null;
    }
  }

  private ttlMilliseconds(expiresAt: string): number {
    return Math.max(1, Date.parse(expiresAt) - Date.now());
  }
}
