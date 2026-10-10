import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  KeyObject,
} from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { resolveAuthRuntimeConfig } from './auth-runtime.config';
import { resolveAuthJwtConfig } from './auth-jwt.config';

const ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export interface AuthJwtClaims {
  app_code: string;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  portal?: string;
  sub: string;
}

@Injectable()
export class AuthJwtService {
  private readonly runtime = resolveAuthRuntimeConfig();
  private readonly config = resolveAuthJwtConfig();
  private privateKey: KeyObject | undefined;
  private publicKey: KeyObject | undefined;

  shouldIssue(): boolean {
    return this.runtime.tokenMode === 'jwt' || this.runtime.tokenMode === 'dual';
  }

  assertReady(): void {
    this.getPrivateKey();
    this.getPublicKey();
  }

  issueAccessToken(user: CurrentUser, sessionId: string): string {
    const privateKey = this.getPrivateKey();
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      kid: this.config.keyId,
      typ: 'JWT',
    };
    const claims: AuthJwtClaims = {
      app_code: user.appCode ?? this.runtime.appCode,
      aud: user.appCode ?? this.runtime.appCode,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
      iat: now,
      iss: this.config.issuer,
      jti: sessionId,
      portal: user.portal,
      sub: String(user.id),
    };
    const encodedHeader = this.encode(header);
    const encodedClaims = this.encode(claims);
    const signingInput = `${encodedHeader}.${encodedClaims}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    return `${signingInput}.${signer.sign(privateKey).toString('base64url')}`;
  }

  verifyAccessToken(
    token: string,
    expectedAppCode: string | null = this.runtime.appCode,
  ): AuthJwtClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('访问令牌格式无效');
    }

    let header: { alg?: string; kid?: string; typ?: string };
    let claims: AuthJwtClaims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('访问令牌格式无效');
    }

    if (
      header.alg !== 'RS256' ||
      header.typ !== 'JWT' ||
      header.kid !== this.config.keyId ||
      claims.iss !== this.config.issuer ||
      claims.aud !== claims.app_code ||
      (expectedAppCode !== null && claims.app_code !== expectedAppCode) ||
      typeof claims.sub !== 'string' ||
      typeof claims.jti !== 'string' ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    if (
      !verifier.verify(
        this.getPublicKey(),
        Buffer.from(parts[2], 'base64url'),
      )
    ) {
      throw new UnauthorizedException('访问令牌签名无效');
    }

    return claims;
  }

  getJwks(): { keys: Array<Record<string, string>> } {
    if (!this.config.publicKey) {
      return { keys: [] };
    }
    const jwk = this.getPublicKey().export({ format: 'jwk' }) as {
      e: string;
      kty: string;
      n: string;
    };
    return {
      keys: [
        {
          alg: 'RS256',
          e: jwk.e,
          kid: this.config.keyId,
          kty: jwk.kty,
          n: jwk.n,
          use: 'sig',
        },
      ],
    };
  }

  private getPrivateKey(): KeyObject {
    if (!this.config.privateKey) {
      throw new Error(
        'AUTH_TOKEN_MODE=jwt or dual requires AUTH_JWT_PRIVATE_KEY',
      );
    }
    this.privateKey ??= createPrivateKey(this.config.privateKey);
    return this.privateKey;
  }

  private getPublicKey(): KeyObject {
    if (!this.config.publicKey) {
      throw new Error(
        'JWT verification requires AUTH_JWT_PUBLIC_KEY',
      );
    }
    this.publicKey ??= createPublicKey(this.config.publicKey);
    return this.publicKey;
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
