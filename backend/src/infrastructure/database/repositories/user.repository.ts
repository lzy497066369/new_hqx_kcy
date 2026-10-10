import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  findByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { username },
    });
  }

  findByUsernameWithRelations(username: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      relations: {
        userRoles: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      },
      where: { username },
    });
  }

  findByPhone(phone: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { phone },
    });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { email },
    });
  }

  findByLoginAccountWithRelations(account: string): Promise<UserEntity | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('role.rolePermissions', 'rolePermission')
      .leftJoinAndSelect('rolePermission.permission', 'permission')
      .where('user.username = :account', { account })
      .orWhere('user.phone = :account', { account })
      .orWhere('user.email = :account', { account })
      .getOne();
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      relations: {
        userRoles: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      },
      where: { id },
    });
  }

  async save(user: UserEntity): Promise<UserEntity> {
    return this.userRepo.save(user);
  }
}
