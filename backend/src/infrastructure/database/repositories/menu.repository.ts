import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { PortalType } from '../../../common/types/portal-type';
import { DEFAULT_AUTH_APP_CODE } from '../../../modules/auth/auth-runtime.config';
import { MenuEntity } from '../entities/menu.entity';

@Injectable()
export class MenuRepository {
  constructor(
    @InjectRepository(MenuEntity)
    private readonly menuRepo: Repository<MenuEntity>,
  ) {}

  async findAll(
    portalType?: PortalType,
    appCode = DEFAULT_AUTH_APP_CODE,
  ): Promise<MenuEntity[]> {
    return this.menuRepo.find({
      order: {
        orderNum: 'ASC',
        id: 'ASC',
      },
      where: portalType ? { appCode, portalType } : { appCode },
    });
  }
}
