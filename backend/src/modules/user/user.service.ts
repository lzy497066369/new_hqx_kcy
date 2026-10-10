import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../../common/interfaces/current-user.interface';
import type { PortalType } from '../../common/types/portal-type';
import {
  buildUploadPublicUrl,
  normalizeStoredUploadPath,
} from '../../common/utils/upload.util';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { AuthService } from '../auth/auth.service';
import { UpdatePasswordDto, UpdateProfileDto } from './dto';

export type UserProfile = CurrentUser & {
  avatar: null | string;
  introduction: string | null;
  userId: number;
};

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async getProfile(
    userId: number,
    portal?: PortalType,
    request?: Request,
  ): Promise<UserProfile> {
    return this.toProfile(await this.findUser(userId), portal, request);
  }

  async updateProfile(
    userId: number,
    input: UpdateProfileDto,
    portal?: PortalType,
    request?: Request,
  ): Promise<UserProfile> {
    const user = await this.findUser(userId);

    if (input.realName !== undefined) {
      user.realName = input.realName.trim();
    }

    if (input.username !== undefined) {
      const username = input.username.trim();
      if (username && username !== user.username) {
        const exists = await this.userRepository.findByUsername(username);
        if (exists && String(exists.id) !== String(user.id)) {
          throw new BadRequestException('username already exists');
        }
      }
      user.username = username;
    }

    if (input.phone !== undefined) {
      const phone = this.toNullableString(input.phone);
      if (phone && phone !== user.phone) {
        const exists = await this.userRepository.findByPhone(phone);
        if (exists && String(exists.id) !== String(user.id)) {
          throw new BadRequestException('phone already exists');
        }
      }
      user.phone = phone;
    }

    if (input.email !== undefined) {
      const email = this.toNullableString(input.email);
      if (email && email !== user.email) {
        const exists = await this.userRepository.findByEmail(email);
        if (exists && String(exists.id) !== String(user.id)) {
          throw new BadRequestException('email already exists');
        }
      }
      user.email = email;
    }

    if (input.avatar !== undefined) {
      user.avatarPath = normalizeStoredUploadPath(input.avatar);
    }

    if (input.introduction !== undefined) {
      user.remark = this.toNullableString(input.introduction);
    }

    return this.toProfile(await this.userRepository.save(user), portal, request);
  }

  async updatePassword(
    userId: number,
    input: UpdatePasswordDto,
  ): Promise<void> {
    const user = await this.findUser(userId);

    if (!input.oldPassword?.trim() || !input.newPassword?.trim()) {
      throw new BadRequestException('password cannot be empty');
    }
    if (!(await verifyPassword(input.oldPassword.trim(), user.password))) {
      throw new BadRequestException('old password is incorrect');
    }

    user.password = await hashPassword(input.newPassword.trim());
    await this.userRepository.save(user);
  }

  private async findUser(userId: number): Promise<UserEntity> {
    const user = await this.userRepository.findById(String(userId));
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return user;
  }

  private async toProfile(
    user: UserEntity,
    portal?: PortalType,
    request?: Request,
  ): Promise<UserProfile> {
    const access = await this.authService.resolvePortalAccess(
      user,
      portal ?? user.portalType,
    );

    return {
      avatar: buildUploadPublicUrl(user.avatarPath, request),
      email: user.email,
      homePath: access.homePath,
      id: Number(user.id),
      introduction: user.remark ?? null,
      permissions: access.permissions,
      phone: user.phone,
      portal,
      realName: user.realName,
      roleNames: access.roleNames,
      roles: access.roles,
      userId: Number(user.id),
      username: user.username,
    };
  }

  private toNullableString(value?: null | string): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const text = value.trim();
    return text ? text : null;
  }
}
