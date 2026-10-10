import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PermissionEntity } from '../entities/permission.entity';

@Injectable()
export class PermissionRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
  ) {}

  async findByCodes(codes: string[]): Promise<PermissionEntity[]> {
    if (codes.length === 0) {
      return [];
    }

    return this.permissionRepo.find({
      where: {
        code: In(codes),
      },
    });
  }
}
