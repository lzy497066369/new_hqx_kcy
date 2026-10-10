import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { RegionEntity } from '../../../infrastructure/database/entities/region.entity';
import { toStringId } from '../../system/shared/system.utils';

@Injectable()
export class RegionAccessService {
  constructor(
    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,
  ) {}

  isSystemAdmin(user?: CurrentUser): boolean {
    return Boolean(user?.roles?.includes('admin') && !user?.roles?.includes('region_leader'));
  }

  async getAccessibleRegionIds(user?: CurrentUser): Promise<Set<string> | null> {
    if (this.isSystemAdmin(user)) {
      return null;
    }
    // Geographic regions are classifications, not an account authorization chain.
    return new Set();
  }

  async assertHasRegionAccess(user?: CurrentUser): Promise<void> {
    const accessibleIds = await this.getAccessibleRegionIds(user);
    if (accessibleIds !== null && accessibleIds.size === 0) {
      throw new ForbiddenException('当前用户无权管理区域政策数据');
    }
  }

  async assertCanAccessRegion(
    user: CurrentUser | undefined,
    regionId: null | string | undefined,
    options: { allowAllForAdmin?: boolean } = {},
  ): Promise<void> {
    if (this.isSystemAdmin(user)) {
      if (!regionId && !options.allowAllForAdmin) {
        throw new ForbiddenException('请选择具体区域');
      }
      return;
    }

    if (!regionId) {
      throw new ForbiddenException('当前用户无权操作全部区域');
    }
    const accessibleIds = await this.getAccessibleRegionIds(user);
    if (!accessibleIds?.has(String(regionId))) {
      throw new ForbiddenException('当前用户无权管理区域政策数据');
    }
  }

  async filterRegionIdsForUser(
    user: CurrentUser | undefined,
    regionIds: Array<null | string>,
  ): Promise<Set<null | string>> {
    const accessibleIds = await this.getAccessibleRegionIds(user);
    if (accessibleIds === null) {
      return new Set(regionIds);
    }
    return new Set(
      regionIds.filter((regionId) => regionId && accessibleIds.has(String(regionId))),
    );
  }

  async getRegionOrThrow(id: string): Promise<RegionEntity> {
    const entity = await this.regionRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new ForbiddenException('区域不存在或无权访问');
    }
    return entity;
  }

}
