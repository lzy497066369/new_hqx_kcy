import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { IamCompanyScopeService } from '../../../common/auth/iam-company-scope.service';
import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { EnterpriseEntity } from '../../../infrastructure/database/entities/enterprise.entity';
import { ClientDeclarationEntity } from '../../../infrastructure/database/entities/client-declaration.entity';
import { EnterpriseUserEntity } from '../../../infrastructure/database/entities/enterprise-user.entity';
import { EnterpriseOwnerEntity } from '../../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterpriseTeacherEntity } from '../../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseProfileStatEntity } from '../../../infrastructure/database/entities/enterprise-profile-stat.entity';
import { UserEntity } from '../../../infrastructure/database/entities/user.entity';
import { toNullableString, toNumber, toStringId } from '../../system/shared/system.utils';
import { EnterpriseAccountService } from '../shared/enterprise-account.service';
import { EnterpriseTeacherService } from '../teacher/teacher.service';
import { EnterpriseInput } from './dto';
import { isEnterpriseProfileIncomplete } from './profile-completeness';

type EnterpriseItem = {
  address: null | string;
  city: null | string;
  contactEmail: null | string;
  contactName: null | string;
  contactPhone: null | string;
  createTime: string;
  creditCode: string;
  declarationProjects: string[];
  district: null | string;
  enterpriseType: null | string;
  id: string;
  industry: null | string;
  legalPerson: null | string;
  name: string;
  profileStatus: string;
  province: null | string;
  remark: null | string;
  shortName: null | string;
  source: null | string;
  status: number;
  updateTime: string;
};

@Injectable()
export class EnterpriseProfileService {
  constructor(
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(ClientDeclarationEntity)
    private readonly declarationRepo: Repository<ClientDeclarationEntity>,
    @InjectRepository(EnterpriseOwnerEntity)
    private readonly enterpriseOwnerRepo: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly enterpriseTeacherRepo: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(EnterpriseProfileStatEntity)
    private readonly profileStatRepo: Repository<EnterpriseProfileStatEntity>,
    private readonly accountService: EnterpriseAccountService,
    private readonly teacherService: EnterpriseTeacherService,
    private readonly iamCompanyScope: IamCompanyScopeService,
    @InjectRepository(EnterpriseUserEntity) private readonly enterpriseUserRepo: Repository<EnterpriseUserEntity>,
  ) {}

  async list(
    query: Record<string, string | string[] | undefined>,
    currentUser?: CurrentUser,
  ): Promise<{ items: EnterpriseItem[]; total: number }> {
    const rows = await this.enterpriseRepo.find({
      order: {
        updatedAt: 'DESC',
        id: 'DESC',
      },
    });

    let items = rows.map((row) => this.toItem(row));
    const scopedEnterpriseIds = await this.getScopedEnterpriseIds(currentUser);
    if (scopedEnterpriseIds) {
      items = items.filter((item) => scopedEnterpriseIds.has(item.id));
    }
    const name = this.getQueryValue(query.name)?.trim().toLowerCase();
    const creditCode = this.getQueryValue(query.creditCode)?.trim().toLowerCase();
    const industry = this.getQueryValue(query.industry)?.trim().toLowerCase();
    const enterpriseType = this.getQueryValue(query.enterpriseType)?.trim().toLowerCase();
    const profileStatus = this.getQueryValue(query.profileStatus)?.trim().toLowerCase();
    const incomplete = this.getQueryValue(query.incomplete) === '1';
    const status = this.getQueryValue(query.status);

    if (name) {
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(name) ||
          (item.shortName ?? '').toLowerCase().includes(name),
      );
    }
    if (creditCode) {
      items = items.filter((item) => item.creditCode.toLowerCase().includes(creditCode));
    }
    if (industry) {
      items = items.filter((item) => (item.industry ?? '').toLowerCase().includes(industry));
    }
    if (enterpriseType) {
      items = items.filter((item) =>
        (item.enterpriseType ?? '').toLowerCase().includes(enterpriseType),
      );
    }
    if (profileStatus) {
      items = items.filter(
        (item) => item.profileStatus.toLowerCase() === profileStatus,
      );
    }
    if (status !== undefined) {
      items = items.filter((item) => String(item.status) === status);
    }
    if (incomplete) {
      const stats = await this.profileStatRepo.find({
        where: { enterpriseId: In(items.map((item) => item.id)) },
      });
      const completenessByEnterpriseId = new Map(
        stats.map((item) => [String(item.enterpriseId), item.completenessRate]),
      );
      items = items.filter((item) =>
        isEnterpriseProfileIncomplete(
          item.profileStatus,
          completenessByEnterpriseId.get(item.id),
        ),
      );
    }

    const page = Math.max(Number(this.getQueryValue(query.page) ?? 1), 1);
    const pageSizeValue = this.getQueryValue(query.pageSize);
    const pageSize = Math.max(Number((pageSizeValue ?? items.length) || 10), 1);
    const start = (page - 1) * pageSize;

    return {
      items: await this.withDeclarationProjects(
        items.slice(start, start + pageSize),
      ),
      total: items.length,
    };
  }

  async detail(id: string, currentUser?: CurrentUser): Promise<EnterpriseItem> {
    const entity = await this.requireEnterprise(id);
    await this.assertEnterpriseVisible(entity.id, currentUser);
    return this.toItem(entity);
  }

  async create(
    input: EnterpriseInput,
    creator?: CurrentUser,
  ): Promise<EnterpriseItem> {
    if (creator?.portal === 'client') throw new ForbiddenException('请通过区域总览统一建档并分发');
    const contactName = this.normalizeRequiredText(
      input.contactName ?? undefined,
      '联系人不能为空',
    );
    const contactPhone = this.normalizeRequiredText(
      input.contactPhone ?? undefined,
      '联系电话不能为空',
    );
    const contactEmail = this.normalizeRequiredText(
      input.contactEmail ?? undefined,
      '联系邮箱不能为空',
    );

    const entity = this.enterpriseRepo.create({
      address: toNullableString(input.address),
      city: toNullableString(input.city),
      code: this.generateInternalCode(),
      contactEmail,
      contactName,
      contactPhone,
      creditCode: this.normalizeRequiredText(input.creditCode, '统一社会信用代码不能为空'),
      district: toNullableString(input.district),
      enterpriseType: toNullableString(input.enterpriseType),
      industry: toNullableString(input.industry),
      legalPerson: toNullableString(input.legalPerson),
      name: this.normalizeRequiredText(input.name, '企业名称不能为空'),
      profileStatus: this.normalizeProfileStatus(input.profileStatus, 'draft'),
      province: toNullableString(input.province),
      remark: toNullableString(input.remark),
      shortName: toNullableString(input.shortName),
      source: toNullableString(input.source),
      status: this.normalizeEnabled(input.status, 1),
    });

    await this.ensureCreditCodeAvailable(entity.creditCode ?? '');

    let savedEnterprise: EnterpriseEntity | undefined;
    let savedUser: UserEntity | undefined;

    try {
      savedEnterprise = await this.enterpriseRepo.save(entity);
      savedUser = await this.accountService.createAccount(
        {
          email: contactEmail,
          name: contactName,
          password: contactPhone,
          phone: contactPhone,
          remark: `${savedEnterprise.name}默认主账号`,
          status: 1,
          username: contactPhone,
        },
        'enterprise_owner',
      );

      await this.enterpriseOwnerRepo.save(
        this.enterpriseOwnerRepo.create({
          enterpriseId: savedEnterprise.id,
          remark: '默认主账号',
          status: 1,
          userId: savedUser.id,
        }),
      );

      await this.teacherService.ensureDefaultTeacherForEnterprise(
        savedEnterprise.id,
        creator,
      );

      return this.toItem(savedEnterprise);
    } catch (error) {
      if (savedUser) {
        await this.accountService.removeAccount(savedUser);
      }
      if (savedEnterprise) {
        await this.enterpriseRepo.delete({ id: savedEnterprise.id });
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: EnterpriseInput,
    currentUser?: CurrentUser,
  ): Promise<EnterpriseItem> {
    const entity = await this.requireEnterprise(id);
    await this.assertEnterpriseVisible(entity.id, currentUser);

    if (input.name !== undefined) {
      entity.name = this.normalizeRequiredText(input.name, '企业名称不能为空');
    }
    if (input.creditCode !== undefined) {
      entity.creditCode = this.normalizeRequiredText(input.creditCode, '统一社会信用代码不能为空');
    }
    if (input.shortName !== undefined) {
      entity.shortName = toNullableString(input.shortName);
    }
    if (input.legalPerson !== undefined) {
      entity.legalPerson = toNullableString(input.legalPerson);
    }
    if (input.contactName !== undefined) {
      entity.contactName = toNullableString(input.contactName);
    }
    if (input.contactPhone !== undefined) {
      entity.contactPhone = toNullableString(input.contactPhone);
    }
    if (input.contactEmail !== undefined) {
      entity.contactEmail = toNullableString(input.contactEmail);
    }
    if (input.industry !== undefined) {
      entity.industry = toNullableString(input.industry);
    }
    if (input.enterpriseType !== undefined) {
      entity.enterpriseType = toNullableString(input.enterpriseType);
    }
    if (input.province !== undefined) {
      entity.province = toNullableString(input.province);
    }
    if (input.city !== undefined) {
      entity.city = toNullableString(input.city);
    }
    if (input.district !== undefined) {
      entity.district = toNullableString(input.district);
    }
    if (input.address !== undefined) {
      entity.address = toNullableString(input.address);
    }
    if (input.profileStatus !== undefined) {
      entity.profileStatus = this.normalizeProfileStatus(
        input.profileStatus,
        entity.profileStatus,
      );
    }
    if (input.status !== undefined) {
      entity.status = this.normalizeEnabled(input.status, entity.status);
    }
    if (input.source !== undefined) {
      entity.source = toNullableString(input.source);
    }
    if (input.remark !== undefined) {
      entity.remark = toNullableString(input.remark);
    }

    await this.ensureCreditCodeAvailable(entity.creditCode ?? '', entity.id);
    return this.toItem(await this.enterpriseRepo.save(entity));
  }

  async remove(id: string, currentUser?: CurrentUser): Promise<void> {
    const entity = await this.requireEnterprise(id);
    await this.assertEnterpriseVisible(entity.id, currentUser);
    await this.enterpriseRepo.delete({ id: entity.id });
  }

  private isProjectTeacherScoped(user?: CurrentUser): user is CurrentUser {
    return Boolean(
      user &&
        user.portal === 'admin' &&
        user.roles.includes('project_teacher') &&
        !user.roles.includes('admin'),
    );
  }

  private async getScopedEnterpriseIds(
    user?: CurrentUser,
  ): Promise<Set<string> | null> {
    if (user && this.iamCompanyScope.isEnabled()) {
      return this.iamCompanyScope.getScopedEnterpriseIds(user);
    }
    if (user?.portal === 'client') {
      const [teachers, owners, members] = await Promise.all([
        this.enterpriseTeacherRepo.find({ where: { teacherUserId: String(user.id), status: 1 } }),
        this.enterpriseOwnerRepo.find({ where: { userId: String(user.id), status: 1 } }),
        this.enterpriseUserRepo.find({ where: { userId: String(user.id), status: 1 } }),
      ]);
      return new Set([...teachers, ...owners, ...members].map((item) => String(item.enterpriseId)));
    }
    if (!this.isProjectTeacherScoped(user)) {
      return null;
    }

    const bindings = await this.enterpriseTeacherRepo.find({
      where: {
        status: 1,
        teacherUserId: toStringId(user.id),
      },
    });

    return new Set(bindings.map((item) => String(item.enterpriseId)));
  }

  private async assertEnterpriseVisible(
    enterpriseId: string,
    user?: CurrentUser,
  ): Promise<void> {
    const scopedEnterpriseIds = await this.getScopedEnterpriseIds(user);
    if (scopedEnterpriseIds && !scopedEnterpriseIds.has(String(enterpriseId))) {
      throw new ForbiddenException('只能访问自己负责的企业');
    }
  }

  private async requireEnterprise(id: string): Promise<EnterpriseEntity> {
    const entity = await this.enterpriseRepo.findOne({
      where: { id: toStringId(id) },
    });
    if (!entity) {
      throw new NotFoundException('企业资料不存在');
    }

    return entity;
  }

  private async ensureCreditCodeAvailable(
    creditCode: string,
    excludeId?: string,
  ): Promise<void> {
    if (!creditCode) return; // Unassigned drafts have no credit code yet.
    const existing = await this.enterpriseRepo.findOne({
      where: { creditCode },
    });
    if (existing && String(existing.id) !== String(excludeId ?? '')) {
      throw new BadRequestException('统一社会信用代码已存在');
    }
  }

  private getQueryValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizeRequiredText(value: string | undefined, message: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private normalizeEnabled(value: number | string | undefined, fallback: number): number {
    const enabled = toNumber(value, fallback);
    if (enabled !== 0 && enabled !== 1) {
      throw new BadRequestException('启用状态不合法');
    }

    return enabled;
  }

  private normalizeProfileStatus(value: string | undefined, fallback: string): string {
    const normalized = value?.trim() || fallback;
    const allowed = new Set([
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'need_resubmit',
    ]);
    if (!allowed.has(normalized)) {
      throw new BadRequestException('资料状态不合法');
    }

    return normalized;
  }

  private generateInternalCode(): string {
    return `ENTERPRISE_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private toItem(row: EnterpriseEntity): EnterpriseItem {
    return {
      address: row.address,
      city: row.city,
      contactEmail: row.contactEmail,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      createTime: formatDateTimeInBjt(row.createdAt),
      creditCode: row.creditCode ?? '',
      declarationProjects: [],
      district: row.district,
      enterpriseType: row.enterpriseType,
      id: String(row.id),
      industry: row.industry,
      legalPerson: row.legalPerson,
      name: row.name,
      profileStatus: row.profileStatus,
      province: row.province,
      remark: row.remark,
      shortName: row.shortName,
      source: row.source,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
    };
  }

  private async withDeclarationProjects(
    items: EnterpriseItem[],
  ): Promise<EnterpriseItem[]> {
    if (!items.length) return items;

    const rows = await this.declarationRepo.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
      where: { enterpriseId: In(items.map((item) => item.id)) },
    });
    const projectsByEnterpriseId = new Map<string, string[]>();

    for (const row of rows) {
      const projects = projectsByEnterpriseId.get(String(row.enterpriseId)) ?? [];
      if (!projects.includes(row.projectName)) projects.push(row.projectName);
      projectsByEnterpriseId.set(String(row.enterpriseId), projects);
    }

    return items.map((item) => ({
      ...item,
      declarationProjects: projectsByEnterpriseId.get(item.id) ?? [],
    }));
  }
}
