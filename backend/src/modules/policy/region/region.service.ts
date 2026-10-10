import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { RegionEntity } from '../../../infrastructure/database/entities/region.entity';
import { RegionPolicyFileEntity } from '../../../infrastructure/database/entities/region-policy-file.entity';
import { buildTree, toNullableString, toNumber, toStringId } from '../../system/shared/system.utils';
import { RegionAccessService } from '../shared/region-access.service';
import { RegionInput } from './dto';

type RegionLevel = 'province' | 'city' | 'district';

type RegionItem = {
  children?: RegionItem[];
  createTime: string;
  id: string;
  level: RegionLevel;
  name: string;
  parentId: string | null;
  remark: string | null;
  sortNum: number;
  status: number;
  updateTime: string;
};

type RegionTreeItem = RegionItem & { children?: RegionTreeItem[] };

const REGION_LEVELS: RegionLevel[] = ['province', 'city', 'district'];

@Injectable()
export class PolicyRegionService {
  constructor(
    @InjectRepository(RegionEntity)
    private readonly regionRepo: Repository<RegionEntity>,
    @InjectRepository(RegionPolicyFileEntity)
    private readonly fileRepo: Repository<RegionPolicyFileEntity>,
    private readonly regionAccessService: RegionAccessService,
  ) {}

  async list(
    query: Record<string, string | string[] | undefined>,
    user?: CurrentUser,
  ): Promise<RegionItem[]> {
    return this.findList(query, user);
  }

  async tree(
    query: Record<string, string | string[] | undefined>,
    user?: CurrentUser,
  ): Promise<RegionTreeItem[]> {
    const items = await this.findList(query, user);
    return buildTree(
      items,
      (left, right) => left.sortNum - right.sortNum || left.id.localeCompare(right.id),
    ) as RegionTreeItem[];
  }

  async create(input: RegionInput): Promise<RegionItem> {
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('区域名称不能为空');
    }

    const level = this.normalizeLevel(input.level);
    const parentId = await this.resolveParentId(level, input.parentId);
    const entity = this.regionRepo.create({
      level,
      name,
      parentId,
      remark: toNullableString(input.remark),
      sortNum: toNumber(input.sortNum, 0),
      status: this.normalizeStatus(input.status, 1),
    });

    return this.toItem(await this.regionRepo.save(entity));
  }

  async update(id: string, input: RegionInput): Promise<RegionItem> {
    const entity = await this.regionRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('区域不存在');
    }

    const previousName = entity.name;
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('区域名称不能为空');
      }
      entity.name = name;
    }

    if (input.level !== undefined || input.parentId !== undefined) {
      const nextLevel =
        input.level === undefined ? (entity.level as RegionLevel) : this.normalizeLevel(input.level);
      await this.assertChildrenMatchLevel(String(entity.id), nextLevel);
      entity.parentId = await this.resolveParentId(nextLevel, input.parentId ?? entity.parentId, entity);
      entity.level = nextLevel;
    }

    if (input.remark !== undefined) {
      entity.remark = toNullableString(input.remark);
    }
    if (input.sortNum !== undefined) {
      entity.sortNum = toNumber(input.sortNum, entity.sortNum);
    }
    if (input.status !== undefined) {
      entity.status = this.normalizeStatus(input.status, entity.status);
    }

    const saved = await this.regionRepo.save(entity);
    if (saved.name !== previousName) {
      await this.fileRepo.update({ regionId: saved.id }, { regionName: saved.name });
    }
    return this.toItem(saved);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.regionRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('区域不存在');
    }

    const childCount = await this.regionRepo.count({ where: { parentId: entity.id } });
    if (childCount > 0) {
      throw new BadRequestException('请先删除子区域');
    }

    const fileCount = await this.fileRepo.count({ where: { regionId: entity.id } });
    if (fileCount > 0) {
      throw new BadRequestException('请先删除该区域下的政策文件');
    }

    await this.regionRepo.delete({ id: entity.id });
  }

  private async findList(
    query: Record<string, string | string[] | undefined>,
    user?: CurrentUser,
  ): Promise<RegionItem[]> {
    const rows = await this.regionRepo.find({
      order: {
        sortNum: 'ASC',
        id: 'ASC',
      },
    });

    let items = rows.map((row) => this.toItem(row));
    const accessibleIds = await this.regionAccessService.getAccessibleRegionIds(user);
    if (accessibleIds !== null) {
      items = items.filter((item) => accessibleIds.has(item.id));
    }
    const name = this.getQueryValue(query.name)?.trim().toLowerCase();
    const level = this.getQueryValue(query.level)?.trim();
    const status = this.getQueryValue(query.status);

    if (name) {
      items = items.filter((item) => item.name.toLowerCase().includes(name));
    }
    if (level) {
      items = items.filter((item) => item.level === level);
    }
    if (status !== undefined) {
      items = items.filter((item) => String(item.status) === status);
    }

    return items;
  }

  private normalizeLevel(value?: string): RegionLevel {
    if (!value || !REGION_LEVELS.includes(value as RegionLevel)) {
      throw new BadRequestException('区域级别只能是 province、city、district');
    }
    return value as RegionLevel;
  }

  private normalizeStatus(value: number | string | undefined, fallback: number): number {
    const status = toNumber(value, fallback);
    if (status !== 0 && status !== 1) {
      throw new BadRequestException('启停状态只能是 0 或 1');
    }
    return status;
  }

  private async resolveParentId(
    level: RegionLevel,
    parentId?: string | null,
    current?: RegionEntity,
  ): Promise<string | null> {
    const normalizedParentId = toNullableString(parentId);
    if (level === 'province') {
      if (normalizedParentId) {
        throw new BadRequestException('省级区域不能选择上级区域');
      }
      return null;
    }

    if (!normalizedParentId) {
      throw new BadRequestException(level === 'city' ? '市级区域必须选择省级上级' : '区级区域必须选择市级上级');
    }
    if (current && normalizedParentId === String(current.id)) {
      throw new BadRequestException('上级区域不能选择自己');
    }

    const parent = await this.regionRepo.findOne({ where: { id: toStringId(normalizedParentId) } });
    if (!parent) {
      throw new BadRequestException('上级区域不存在');
    }
    if (level === 'city' && parent.level !== 'province') {
      throw new BadRequestException('市级区域的上级必须是省级区域');
    }
    if (level === 'district' && parent.level !== 'city') {
      throw new BadRequestException('区级区域的上级必须是市级区域');
    }

    if (current) {
      await this.assertNotDescendantParent(String(current.id), normalizedParentId);
    }

    return normalizedParentId;
  }

  private async assertNotDescendantParent(currentId: string, parentId: string): Promise<void> {
    const rows = await this.regionRepo.find({
      order: {
        id: 'ASC',
      },
    });

    const parentMap = new Map(
      rows.map((row) => [String(row.id), row.parentId ? String(row.parentId) : null]),
    );

    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === currentId) {
        throw new BadRequestException('上级区域不能选择当前区域或其子区域');
      }
      cursor = parentMap.get(cursor) ?? null;
    }
  }

  private async assertChildrenMatchLevel(currentId: string, level: RegionLevel): Promise<void> {
    const children = await this.regionRepo.find({
      order: {
        sortNum: 'ASC',
        id: 'ASC',
      },
      where: { parentId: toStringId(currentId) },
    });

    if (children.length === 0) {
      return;
    }
    if (level === 'district') {
      throw new BadRequestException('区级区域不能包含下级区域');
    }

    const expectedChildLevel = level === 'province' ? 'city' : 'district';
    const invalidChild = children.find((child) => child.level !== expectedChildLevel);
    if (invalidChild) {
      throw new BadRequestException(
        level === 'province' ? '省级区域下只能挂市级区域' : '市级区域下只能挂区级区域',
      );
    }
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private toItem(row: RegionEntity): RegionItem {
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      id: String(row.id),
      level: row.level as RegionLevel,
      name: row.name,
      parentId: row.parentId ? String(row.parentId) : null,
      remark: row.remark,
      sortNum: row.sortNum,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }
}
