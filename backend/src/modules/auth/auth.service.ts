import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { SessionRecord } from '../../common/interfaces/session-record.interface';
import type { PortalType } from '../../common/types/portal-type';
import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from '../../common/utils/password.util';
import { EnterpriseTeacherEntity } from '../../infrastructure/database/entities/enterprise-teacher.entity';
import { AppEntity } from '../../infrastructure/database/entities/app.entity';
import { MenuEntity } from '../../infrastructure/database/entities/menu.entity';
import { PermissionEntity } from '../../infrastructure/database/entities/permission.entity';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserAppEntity } from '../../infrastructure/database/entities/user-app.entity';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { resolveAuthRuntimeConfig } from './auth-runtime.config';
import { DEFAULT_AUTH_PORTAL } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { SessionStore } from './session-store.port';

const CLIENT_HOME_PATH = '/home';
const PROJECT_TEACHER_ROLE_CODE = 'project_teacher';
const CLIENT_LEADER_ROLE_CODES = new Set(['global_leader', PROJECT_TEACHER_ROLE_CODE, 'enterprise_owner']);

export interface PortalAccess {
  homePath?: string;
  permissions: string[];
  roleNames: string[];
  roles: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionStore: SessionStore,
    @InjectRepository(MenuEntity)
    private readonly menuRepo: Repository<MenuEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly teacherRepo: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(AppEntity)
    private readonly appRepo: Repository<AppEntity>,
    @InjectRepository(UserAppEntity)
    private readonly userAppRepo: Repository<UserAppEntity>,
  ) {}

  async login(dto: LoginDto): Promise<SessionRecord> {
    const account = dto.username.trim();
    const password = dto.password.trim();
    const appCode = this.resolveAppCode(dto.appCode);
    const app = await this.appRepo.findOne({
      where: { code: appCode, status: 1 },
    });
    if (!app) {
      throw new UnauthorizedException('当前账号无该系统访问权限');
    }
    const portal = dto.portal ?? app.defaultPortal ?? DEFAULT_AUTH_PORTAL;
    if (portal === 'admin' && resolveAuthRuntimeConfig().clientOnly) {
      throw new UnauthorizedException('管理端已停用，请使用客户端登录入口');
    }
    const user = await this.userRepository.findByLoginAccountWithRelations(
      account,
    );

    if (!user || !(await verifyPassword(password, user.password))) {
      throw new UnauthorizedException('用户名、手机号、邮箱或密码错误');
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('当前账号无该端访问权限');
    }

    const userApp = await this.userAppRepo.findOne({
      where: {
        appCode,
        portalType: portal,
        status: 1,
        userId: user.id,
      },
    });
    if (!userApp) {
      throw new UnauthorizedException('当前账号无该系统访问权限');
    }

    if (portal === 'client') this.assertStrictClientPersona(user, appCode);

    const access = await this.resolvePortalAccess(
      user,
      portal,
      appCode,
      userApp?.homePath ?? undefined,
    );

    if (access.roles.length === 0) {
      throw new UnauthorizedException('当前账号无该端访问权限');
    }

    await this.ensureClientProjectTeacherHasBinding(user, portal, access);

    if (!isPasswordHash(user.password)) {
      user.password = await hashPassword(password);
      await this.userRepository.save(user);
    }

    return this.sessionStore.createSession({
      appCode,
      email: user.email,
      homePath: access.homePath,
      id: Number(user.id),
      permissions: access.permissions,
      phone: user.phone,
      portal,
      realName: user.realName,
      roleNames: access.roleNames,
      roles: access.roles,
      username: user.username,
    });
  }

  async refresh(refreshToken: string | null): Promise<SessionRecord> {
    if (!refreshToken) {
      throw new BadRequestException('缺少刷新令牌');
    }

    const existing = await this.sessionStore.findByRefreshToken(refreshToken);
    if (existing?.user.portal === 'client' && existing.user.roles.some((role) => ['project_teacher', 'enterprise_owner'].includes(role))) {
      const current = await this.userRepository.findById(String(existing.user.id));
      if (!current || current.status !== 1) {
        await this.sessionStore.revokeByRefreshToken(refreshToken);
        throw new UnauthorizedException('账号已停用，请重新登录');
      }
    }
    const session = await this.sessionStore.rotateSession(refreshToken);
    if (!session) {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }

    return session;
  }

  async logout(accessToken: string | null, refreshToken: string | null): Promise<void> {
    if (accessToken) {
      await this.sessionStore.revokeByAccessToken(accessToken);
    }

    if (refreshToken) {
      await this.sessionStore.revokeByRefreshToken(refreshToken);
    }
  }

  async getCurrentUser(accessToken: string): Promise<CurrentUser> {
    const session = await this.sessionStore.findByAccessToken(accessToken);
    if (!session) {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }

    return session.user;
  }

  getAccessCodes(user: CurrentUser): string[] {
    return user.permissions ?? [];
  }

  async getAccessCodesByUserId(
    userId: number,
    portal?: PortalType,
    appCode?: string,
  ): Promise<string[]> {
    const user = await this.userRepository.findById(String(userId));
    if (!user) {
      throw new UnauthorizedException('用户不存在或已失效');
    }

    const resolvedAppCode = this.resolveAppCode(appCode);
    const resolvedPortal = portal ?? user.portalType;
    const userApp = await this.userAppRepo.findOne({
      where: {
        appCode: resolvedAppCode,
        portalType: resolvedPortal,
        status: 1,
        userId: user.id,
      },
    });
    if (!userApp) {
      return [];
    }

    return (
      await this.resolvePortalAccess(
        user,
        resolvedPortal,
        resolvedAppCode,
        userApp?.homePath ?? undefined,
      )
    ).permissions;
  }

  async resolvePortalAccess(
    user: UserEntity,
    portal: PortalType,
    appCode = resolveAuthRuntimeConfig().appCode,
    homePath?: string,
  ): Promise<PortalAccess> {
    if (user.portalType === portal) {
      const roles = this.extractRoleEntities(user, portal, appCode);
      return {
        homePath: this.resolveHomePath(user, portal, homePath),
        permissions: this.extractPermissionsFromRoles(roles),
        roleNames: roles.map((item) => item.name),
        roles: roles.map((item) => item.code),
      };
    }


    return {
      homePath: undefined,
      permissions: [],
      roleNames: [],
      roles: [],
    };
  }

  private assertStrictClientPersona(user: UserEntity, appCode: string): void {
    const roles = this.extractRoleEntities(user, 'client', appCode);
    if (user.userRoles?.some(({ role }) => role?.code === 'region_leader' && role.appCode === appCode && role.portalType === 'client')) {
      throw new UnauthorizedException('区域负责人角色已停用，请联系总负责人迁移账号');
    }
    const activeClientRoles = roles
      .map((role) => role.code)
      .filter((code) => CLIENT_LEADER_ROLE_CODES.has(code));
    if (new Set(activeClientRoles).size > 1) {
      throw new UnauthorizedException('客户端负责人账号必须严格互斥，请联系总负责人修正角色绑定');
    }
  }

  private extractRoleEntities(
    user: UserEntity,
    portal: PortalType,
    appCode: string,
  ) {
    return [
      ...new Map(
        user.userRoles
          ?.map((item) => item.role)
          .filter(
            (item): item is NonNullable<typeof item> =>
              Boolean(item) &&
              item.status === 1 &&
              item.portalType === portal &&
              item.appCode === appCode,
          )
          .map((item) => [item.code, item] as const) ?? [],
      ).values(),
    ];
  }

  private extractPermissionsFromRoles(
    roles: ReturnType<AuthService['extractRoleEntities']>,
  ): string[] {
    const permissions = roles.reduce<string[]>((codes, role) => {
      const rolePermissions = role.rolePermissions ?? [];
      rolePermissions.forEach((rolePermission) => {
        if (
          rolePermission.permission &&
          rolePermission.permission.status === 1
        ) {
          codes.push(rolePermission.permission.code);
        }
      });

      return codes;
    }, []);

    return [...new Set(permissions)];
  }

  private async getFullClientPermissions(appCode: string): Promise<string[]> {
    const [permissions, menus] = await Promise.all([
      this.permissionRepo.find({
        where: {
          appCode,
          portalType: 'client',
          status: 1,
        },
      }),
      this.menuRepo.find({
        where: {
          appCode,
          portalType: 'client',
          status: 1,
        },
      }),
    ]);

    return [
      ...new Set([
        ...permissions.map((item) => item.code),
        ...menus.map((item) => item.authCode).filter((item): item is string =>
          Boolean(item),
        ),
      ]),
    ];
  }


  private async ensureClientProjectTeacherHasBinding(
    user: UserEntity,
    portal: PortalType,
    access: PortalAccess,
  ): Promise<void> {
    if (
      portal !== 'client' ||
      !access.roles.includes(PROJECT_TEACHER_ROLE_CODE)
    ) {
      return;
    }

    // Distributed enterprise-leader accounts may sign in before their first profile is created.

  }

  private resolveHomePath(
    user: UserEntity,
    portal: PortalType,
    homePath?: string,
  ): string | undefined {
    if (portal === 'client') {
      const candidate = homePath ?? user.homePath;
      return candidate && !candidate.startsWith('/client/')
        ? candidate
        : CLIENT_HOME_PATH;
    }

    return homePath ?? user.homePath ?? undefined;
  }

  private resolveAppCode(appCode?: string): string {
    return appCode?.trim().toLowerCase() || resolveAuthRuntimeConfig().appCode;
  }
}
