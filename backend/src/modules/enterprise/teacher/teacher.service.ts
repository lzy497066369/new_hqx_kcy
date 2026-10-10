import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseTeacherEntity } from '../../../infrastructure/database/entities/enterprise-teacher.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { toNumber, toStringId } from '../../system/shared/system.utils';
import { EnterpriseTeacherInput } from './dto';

const DEFAULT_TEACHER_USERNAME = 'admin';
const TEACHER_ROLE_CODE = 'project_teacher';

type EnterpriseTeacherItem = {
  createTime: string;
  email: null | string;
  enterpriseId: string;
  enterpriseName: string;
  id: string;
  name: string;
  phone: null | string;
  remark: null | string;
  status: number;
  teacherUserId: string;
  updateTime: string;
  username: string;
};

type TeacherCandidateItem = {
  id: string;
  name: string;
  username: string;
};

@Injectable()
export class EnterpriseTeacherService {
  constructor(
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly teacherRepo: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async candidates(): Promise<TeacherCandidateItem[]> {
    const rows = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin('user.userRoles', 'userRole')
      .leftJoin('userRole.role', 'role')
      .where('user.status = :status', { status: 1 })
      .andWhere('(role.code = :teacherRole OR user.username = :adminUsername)', {
        adminUsername: DEFAULT_TEACHER_USERNAME,
        teacherRole: TEACHER_ROLE_CODE,
      })
      .orderBy('user.id', 'ASC')
      .getMany();

    return rows.map((row) => ({
      id: String(row.id),
      name: row.realName,
      username: row.username,
    }));
  }

  async list(
    query: Record<string, string | string[] | undefined>,
  ): Promise<{ items: EnterpriseTeacherItem[]; total: number }> {
    const rows = await this.teacherRepo.find({
      order: { id: 'DESC' },
      relations: {
        enterprise: true,
        teacher: true,
      },
    });

    let items = rows.map((row) => this.toItem(row));
    const enterpriseId = this.getQueryValue(query.enterpriseId);
    const name = this.getQueryValue(query.name)?.trim().toLowerCase();
    const username = this.getQueryValue(query.username)?.trim().toLowerCase();
    const status = this.getQueryValue(query.status);

    if (enterpriseId) {
      items = items.filter((item) => item.enterpriseId === enterpriseId);
    }
    if (name) {
      items = items.filter((item) => item.name.toLowerCase().includes(name));
    }
    if (username) {
      items = items.filter((item) =>
        item.username.toLowerCase().includes(username),
      );
    }
    if (status !== undefined) {
      items = items.filter((item) => String(item.status) === status);
    }

    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSizeValue = this.getQueryValue(query.pageSize);
    const pageSize = Math.max(Number((pageSizeValue ?? items.length) || 10), 1);
    const start = (page - 1) * pageSize;

    return { items: items.slice(start, start + pageSize), total: items.length };
  }

  async detail(id: string): Promise<EnterpriseTeacherItem> {
    return this.toItem(await this.requireTeacherBinding(id));
  }

  async create(input: EnterpriseTeacherInput): Promise<EnterpriseTeacherItem> {
    const enterprise = await this.requireEnterprise(input.enterpriseId);
    await this.ensureEnterpriseAvailable(enterprise.id);
    const teacher = await this.requireTeacherUser(input.teacherUserId);

    const binding = await this.teacherRepo.save(
      this.teacherRepo.create({
        enterpriseId: enterprise.id,
        remark: input.remark ?? null,
        status: this.normalizeStatus(input.status, 1),
        teacherUserId: teacher.id,
      }),
    );

    return this.detail(binding.id);
  }

  async update(
    id: string,
    input: EnterpriseTeacherInput,
  ): Promise<EnterpriseTeacherItem> {
    const binding = await this.requireTeacherBinding(id);

    if (input.enterpriseId !== undefined) {
      const enterprise = await this.requireEnterprise(input.enterpriseId);
      if (enterprise.id !== binding.enterpriseId) {
        await this.ensureEnterpriseAvailable(enterprise.id, binding.id);
        binding.enterpriseId = enterprise.id;
      }
    }
    if (input.teacherUserId !== undefined) {
      const teacher = await this.requireTeacherUser(input.teacherUserId);
      binding.teacherUserId = teacher.id;
    }
    if (input.status !== undefined) {
      binding.status = this.normalizeStatus(input.status, binding.status);
    }
    if (input.remark !== undefined) {
      binding.remark = input.remark ?? null;
    }

    await this.teacherRepo.save(binding);
    return this.detail(binding.id);
  }

  async remove(id: string): Promise<void> {
    const binding = await this.requireTeacherBinding(id);
    await this.teacherRepo.delete({ id: binding.id });
  }

  async ensureDefaultTeacherForEnterprise(
    enterpriseId: string,
    creator?: CurrentUser,
  ): Promise<void> {
    const existing = await this.teacherRepo.findOne({ where: { enterpriseId } });
    if (existing) {
      return;
    }

    const teacherUserId = creator
      ? toStringId(creator.id)
      : await this.getDefaultTeacherUserId();

    await this.teacherRepo.save(
      this.teacherRepo.create({
        enterpriseId,
        remark:
          creator
            ? '创建企业的用户自动绑定为项目老师'
            : '默认绑定系统管理员账号',
        status: 1,
        teacherUserId,
      }),
    );
  }

  private async requireEnterprise(id?: string): Promise<EnterpriseEntity> {
    if (!id) {
      throw new BadRequestException('所属企业不能为空');
    }

    const enterprise = await this.enterpriseRepo.findOne({
      where: { id: toStringId(id) },
    });
    if (!enterprise) {
      throw new BadRequestException('所属企业不存在');
    }

    return enterprise;
  }

  private async requireTeacherBinding(
    id: string,
  ): Promise<EnterpriseTeacherEntity> {
    const binding = await this.teacherRepo.findOne({
      relations: {
        enterprise: true,
        teacher: true,
      },
      where: { id: toStringId(id) },
    });
    if (!binding) {
      throw new NotFoundException('项目老师绑定不存在');
    }

    return binding;
  }

  private async requireTeacherUser(id?: string): Promise<UserEntity> {
    if (!id) {
      throw new BadRequestException('项目老师不能为空');
    }

    const user = await this.userRepo.findOne({
      relations: {
        userRoles: {
          role: true,
        },
      },
      where: { id: toStringId(id) },
    });
    if (!user || user.status !== 1) {
      throw new BadRequestException('项目老师账号不存在或已停用');
    }

    const canBind = this.canBindAsTeacher(user);
    if (!canBind) {
      throw new BadRequestException('请选择项目老师角色账号');
    }

    return user;
  }

  private async ensureEnterpriseAvailable(
    enterpriseId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.teacherRepo.findOne({ where: { enterpriseId } });
    if (existing && String(existing.id) !== String(excludeId ?? '')) {
      throw new BadRequestException('该企业已绑定项目老师');
    }
  }

  private async getDefaultTeacherUserId(): Promise<string> {
    const admin = await this.userRepo.findOne({
      where: {
        status: 1,
        username: DEFAULT_TEACHER_USERNAME,
      },
    });
    if (!admin) {
      throw new BadRequestException('未找到启用的系统管理员账号');
    }

    return admin.id;
  }

  private canBindAsTeacher(user: UserEntity): boolean {
    if (user.username === DEFAULT_TEACHER_USERNAME) {
      return true;
    }

    return (
      user.userRoles?.some((item) => item.role?.code === TEACHER_ROLE_CODE) ??
      false
    );
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizeStatus(
    value: number | string | undefined,
    fallback: number,
  ): number {
    const status = toNumber(value, fallback);
    if (status !== 0 && status !== 1) {
      throw new BadRequestException('绑定状态不合法');
    }
    return status;
  }

  private toItem(row: EnterpriseTeacherEntity): EnterpriseTeacherItem {
    const teacher = row.teacher as UserEntity;
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      email: teacher.email,
      enterpriseId: String(row.enterpriseId),
      enterpriseName: row.enterprise?.name ?? '-',
      id: String(row.id),
      name: teacher.realName,
      phone: teacher.phone,
      remark: row.remark,
      status: row.status,
      teacherUserId: String(row.teacherUserId),
      updateTime: formatDateTimeInBjt(row.updatedAt),
      username: teacher.username,
    };
  }
}
