import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DeptEntity } from '../../../infrastructure/database/entities/dept.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { DeptInput } from './dto';
import { buildTree, toNullableString, toNumber, toStringId } from '../shared/system.utils';

type DeptItem = {
  children?: DeptItem[];
  createTime: string;
  id: string;
  name: string;
  parentId: string | null;
  remark: string | null;
  sortNum: number;
  status: number;
  updateTime: string;
};

@Injectable()
export class SystemDeptService {
  constructor(
    @InjectRepository(DeptEntity)
    private readonly deptRepo: Repository<DeptEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async list(): Promise<DeptItem[]> {
    const rows = await this.deptRepo.find({
      order: {
        sortNum: 'ASC',
        id: 'ASC',
      },
    });

    return buildTree(
      rows.map((row) => this.toItem(row)),
      (left, right) => left.sortNum - right.sortNum || left.id.localeCompare(right.id),
    );
  }

  async create(input: DeptInput): Promise<DeptItem> {
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('部门名称不能为空');
    }

    const parentId = await this.resolveParentId(input.parentId);
    const entity = this.deptRepo.create({
      name,
      parentId,
      remark: toNullableString(input.remark),
      sortNum: toNumber(input.sortNum, 0),
      status: toNumber(input.status, 1),
    });
    return this.toItem(await this.deptRepo.save(entity));
  }

  async update(id: string, input: DeptInput): Promise<DeptItem> {
    const entity = await this.deptRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('部门不存在');
    }

    const previousName = entity.name;
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('部门名称不能为空');
      }
      entity.name = name;
    }
    if (input.parentId !== undefined) {
      entity.parentId = await this.resolveParentId(input.parentId, entity);
    }
    if (input.remark !== undefined) {
      entity.remark = toNullableString(input.remark);
    }
    if (input.sortNum !== undefined) {
      entity.sortNum = toNumber(input.sortNum, entity.sortNum);
    }
    if (input.status !== undefined) {
      entity.status = toNumber(input.status, entity.status);
    }

    const saved = await this.deptRepo.save(entity);
    if (saved.name !== previousName) {
      await this.userRepo.update({ deptId: saved.id }, { deptName: saved.name });
    }
    return this.toItem(saved);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.deptRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) {
      throw new NotFoundException('部门不存在');
    }

    const childCount = await this.deptRepo.count({
      where: { parentId: entity.id },
    });
    if (childCount > 0) {
      throw new BadRequestException('请先删除子部门');
    }

    const userCount = await this.userRepo.count({
      where: { deptId: entity.id },
    });
    if (userCount > 0) {
      throw new BadRequestException('请先移除该部门下的用户');
    }

    await this.deptRepo.delete({ id: entity.id });
  }

  private async resolveParentId(
    parentId?: string | null,
    current?: DeptEntity,
  ): Promise<string | null> {
    const normalizedParentId = toNullableString(parentId);
    if (!normalizedParentId) {
      return null;
    }

    if (current && normalizedParentId === String(current.id)) {
      throw new BadRequestException('上级部门不能选择自己');
    }

    const parent = await this.deptRepo.findOne({
      where: { id: toStringId(normalizedParentId) },
    });
    if (!parent) {
      throw new BadRequestException('上级部门不存在');
    }

    if (current) {
      await this.assertNotDescendantParent(String(current.id), normalizedParentId);
    }

    return normalizedParentId;
  }

  private async assertNotDescendantParent(
    currentId: string,
    parentId: string,
  ): Promise<void> {
    const rows = await this.deptRepo.find({
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
        throw new BadRequestException('上级部门不能选择当前部门或其子部门');
      }
      cursor = parentMap.get(cursor) ?? null;
    }
  }

  private toItem(row: DeptEntity): DeptItem {
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      id: String(row.id),
      name: row.name,
      parentId: row.parentId ? String(row.parentId) : null,
      remark: row.remark,
      sortNum: row.sortNum,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }
}
