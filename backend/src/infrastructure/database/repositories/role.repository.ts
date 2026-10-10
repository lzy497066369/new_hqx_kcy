import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RoleEntity } from '../entities/role.entity';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async findByCodes(codes: string[]): Promise<RoleEntity[]> {
    if (codes.length === 0) {
      return [];
    }

    return this.roleRepo.find({
      where: codes.map((code) => ({ code })),
    });
  }
}
