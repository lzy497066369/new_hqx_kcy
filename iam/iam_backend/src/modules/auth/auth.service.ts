import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { hashPassword, verifyPassword } from '../../common/password.util';
import { IamRoleEntity } from '../iam-admin/entities/iam-role.entity';
import { IamUserAppEntity } from '../iam-admin/entities/iam-user-app.entity';
import { IamUserEntity } from '../iam-admin/entities/iam-user.entity';
import { IamUserRoleEntity } from '../iam-admin/entities/iam-user-role.entity';
import { IamDatabaseService } from '../iam-admin/iam-database.service';
import { IamAuditService } from '../audit/iam-audit.service';
import { IamAdminSessionEntity } from './entities/iam-admin-session.entity';
import type { IamCurrentUser } from './auth.types';
import { LoginDto } from './dto/login.dto';

const DEFAULT_BOOTSTRAP_USERNAME = 'iam_admin';
const DEFAULT_BOOTSTRAP_PASSWORD = 'ChangeMe123!';
const IAM_ADMIN_APP_CODE = 'iam_admin';
const DEFAULT_ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

@Injectable()
export class AuthService {
  private readonly sessions = new Map<string, IamCurrentUser>();

  constructor(
    private readonly database: IamDatabaseService,
    private readonly audit: IamAuditService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const username = dto.username.trim();
    const password = dto.password.trim();
    try {
      const user = await this.resolveDatabaseAdmin(username, password);
      const currentUser = user ?? this.getBootstrapUserWhenAllowed(username, password);
      const accessToken = randomBytes(32).toString('base64url');
      await this.saveSession(accessToken, currentUser);
      await this.audit.record({ action: 'iam.admin.login', actorUserId: currentUser.userId, outcome: 'success', username: currentUser.username });
      return { accessToken };
    } catch (error) {
      await this.audit.record({ action: 'iam.admin.login', outcome: 'failure', username });
      throw error;
    }
  }

  async getCurrentUser(accessToken: string): Promise<IamCurrentUser> {
    if (process.env.IAM_DB_DATABASE) {
      const repo = (await this.database.getDataSource()).getRepository(IamAdminSessionEntity);
      const session = await repo.findOne({ where: { tokenHash: this.hashToken(accessToken) } });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        if (session && !session.revokedAt) { session.revokedAt = new Date(); await repo.save(session); }
        throw new UnauthorizedException('Access token is invalid or expired');
      }
      return { avatar: session.avatarPath ?? '', expiresAt: session.expiresAt, homePath: session.homePath, portal: 'admin', realName: session.realName, roles: session.roles, userId: session.userId, username: session.username };
    }
    const user = this.sessions.get(accessToken);
    if (!user || user.expiresAt <= new Date()) {
      this.sessions.delete(accessToken);
      throw new UnauthorizedException('Access token is invalid or expired');
    }
    return user;
  }

  async getAccessCodes(accessToken: string): Promise<string[]> {
    await this.getCurrentUser(accessToken);
    return ['IAM:*'];
  }

  async logout(accessToken: string | null): Promise<void> {
    if (accessToken) {
      const user = await this.getCurrentUserOrNull(accessToken);
      if (process.env.IAM_DB_DATABASE) {
        const repo = (await this.database.getDataSource()).getRepository(IamAdminSessionEntity);
        const session = await repo.findOne({ where: { tokenHash: this.hashToken(accessToken) } });
        if (session && !session.revokedAt) { session.revokedAt = new Date(); await repo.save(session); }
      } else this.sessions.delete(accessToken);
      if (user) await this.audit.record({ action: 'iam.admin.logout', actorUserId: user.userId, outcome: 'success', username: user.username });
    }
  }

  private async getCurrentUserOrNull(accessToken: string): Promise<IamCurrentUser | null> {
    try { return await this.getCurrentUser(accessToken); } catch { return null; }
  }

  private async saveSession(accessToken: string, user: IamCurrentUser): Promise<void> {
    if (!process.env.IAM_DB_DATABASE) { this.sessions.set(accessToken, user); return; }
    const repo = (await this.database.getDataSource()).getRepository(IamAdminSessionEntity);
    await repo.save(repo.create({ avatarPath: user.avatar || null, expiresAt: user.expiresAt, homePath: user.homePath, realName: user.realName, revokedAt: null, roles: user.roles, tokenHash: this.hashToken(accessToken), userId: user.userId, username: user.username }));
  }

  private hashToken(accessToken: string): string { return createHash('sha256').update(accessToken).digest('hex'); }

  private async resolveDatabaseAdmin(
    username: string,
    password: string,
  ): Promise<IamCurrentUser | null> {
    if (!process.env.IAM_DB_DATABASE) return null;

    const dataSource = await this.database.getDataSource();
    const user = await dataSource
      .getRepository(IamUserEntity)
      .findOne({ where: { status: 1, username } });
    if (!user) return null;
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Username or password is incorrect');
    }
    if (!user.passwordHash.startsWith('scrypt$')) {
      user.passwordHash = await hashPassword(password);
      user.passwordChangedAt = new Date();
      await dataSource.getRepository(IamUserEntity).save(user);
    }

    const assignments = await dataSource
      .getRepository(IamUserRoleEntity)
      .find({ where: { appCode: IAM_ADMIN_APP_CODE, userId: user.id } });
    const roleIds = assignments.map((assignment) => assignment.roleId);
    const roles = roleIds.length
      ? await dataSource.getRepository(IamRoleEntity).findByIds(roleIds)
      : [];
    const activeRoles = roles
      .filter((role) => role.status === 1)
      .map((role) => role.roleCode)
      .sort();
    if (!activeRoles.includes('super_admin')) {
      throw new UnauthorizedException('IAM administrator permission is required');
    }

    const userApps = await dataSource
      .getRepository(IamUserAppEntity)
      .find({
        where: { appCode: IAM_ADMIN_APP_CODE, status: 1, userId: user.id },
      });
    return {
      avatar: user.avatarPath ?? '',
      expiresAt: this.adminSessionExpiresAt(),
      homePath: userApps.find((app) => app.homePath)?.homePath ?? '/iam/overview',
      portal: 'admin',
      realName: user.realName,
      roles: activeRoles,
      userId: String(user.id),
      username: user.username,
    };
  }

  private getBootstrapUserWhenAllowed(
    username: string,
    password: string,
  ): IamCurrentUser {
    if (!this.bootstrapLoginEnabled()) {
      throw new UnauthorizedException('Username or password is incorrect');
    }
    if (
      username !==
        (process.env.IAM_BOOTSTRAP_USERNAME ?? DEFAULT_BOOTSTRAP_USERNAME) ||
      password !==
        (process.env.IAM_BOOTSTRAP_PASSWORD ?? DEFAULT_BOOTSTRAP_PASSWORD)
    ) {
      throw new UnauthorizedException('Username or password is incorrect');
    }
    return {
      avatar: '',
      expiresAt: this.adminSessionExpiresAt(),
      homePath: '/iam/overview',
      portal: 'admin',
      realName: 'IAM 管理员',
      roles: ['super_admin'],
      userId: 'bootstrap-admin',
      username,
    };
  }

  private bootstrapLoginEnabled(): boolean {
    const configured = process.env.IAM_ENABLE_BOOTSTRAP_LOGIN;
    if (configured !== undefined) {
      return ['1', 'on', 'true', 'yes'].includes(configured.trim().toLowerCase());
    }
    return process.env.NODE_ENV !== 'production';
  }

  private adminSessionExpiresAt(): Date {
    const configured = Number(process.env.IAM_ADMIN_SESSION_TTL_SECONDS);
    const ttlSeconds = Number.isFinite(configured) && configured > 0
      ? Math.floor(configured)
      : DEFAULT_ADMIN_SESSION_TTL_SECONDS;
    return new Date(Date.now() + ttlSeconds * 1000);
  }
}
