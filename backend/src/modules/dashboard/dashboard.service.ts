import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { formatDateTimeInBjt } from '../../common/utils/date.util';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ClientDeclarationEntity } from '../../infrastructure/database/entities/client-declaration.entity';
import { ClientUserProfileEntity } from '../../infrastructure/database/entities/client-user-profile.entity';
import { EnterpriseEmployeeRecordEntity } from '../../infrastructure/database/entities/enterprise-employee-record.entity';
import { EnterpriseEntity } from '../../infrastructure/database/entities/enterprise.entity';
import { EnterpriseFinanceRecordEntity } from '../../infrastructure/database/entities/enterprise-finance-record.entity';
import { EnterpriseMaterialEntity } from '../../infrastructure/database/entities/enterprise-material.entity';
import { EnterpriseOwnerEntity } from '../../infrastructure/database/entities/enterprise-owner.entity';
import { EnterpriseProfileStatEntity } from '../../infrastructure/database/entities/enterprise-profile-stat.entity';
import { EnterpriseProfileStatItemEntity } from '../../infrastructure/database/entities/enterprise-profile-stat-item.entity';
import { EnterprisePropertyRecordEntity } from '../../infrastructure/database/entities/enterprise-property-record.entity';
import { EnterpriseTeacherEntity } from '../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseUserEntity } from '../../infrastructure/database/entities/enterprise-user.entity';
import { OperationLogEntity } from '../../infrastructure/database/entities/operation-log.entity';
import { PolicyProjectEntity } from '../../infrastructure/database/entities/policy-project.entity';
import { RegionPolicyFileEntity } from '../../infrastructure/database/entities/region-policy-file.entity';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { PolicyCollectService } from '../policy/collect/collect.service';

type EnterpriseScope = {
  ids?: string[];
  scoped: boolean;
};

type CountItem = {
  label: string;
  value: number;
};

type DashboardNotificationItem = {
  actionPath: string;
  actionText: string;
  content: string;
  id: string;
  level: 'high' | 'low' | 'medium';
  status: 'read' | 'unread';
  time: string;
  title: string;
};

type DashboardSyncItem = {
  actionPath: string;
  actionText: string;
  currentStep: null | string;
  description: string;
  id: string;
  jobId: string;
  progress: number;
  runId: string;
  status: string;
  time: string;
  title: string;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ClientDeclarationEntity)
    private readonly declarationRepo: Repository<ClientDeclarationEntity>,
    @InjectRepository(ClientUserProfileEntity)
    private readonly clientUserProfileRepo: Repository<ClientUserProfileEntity>,
    @InjectRepository(EnterpriseEmployeeRecordEntity)
    private readonly employeeRepo: Repository<EnterpriseEmployeeRecordEntity>,
    @InjectRepository(EnterpriseEntity)
    private readonly enterpriseRepo: Repository<EnterpriseEntity>,
    @InjectRepository(EnterpriseFinanceRecordEntity)
    private readonly financeRepo: Repository<EnterpriseFinanceRecordEntity>,
    @InjectRepository(EnterpriseMaterialEntity)
    private readonly materialRepo: Repository<EnterpriseMaterialEntity>,
    @InjectRepository(EnterpriseOwnerEntity)
    private readonly ownerRepo: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(EnterpriseProfileStatEntity)
    private readonly profileStatRepo: Repository<EnterpriseProfileStatEntity>,
    @InjectRepository(EnterpriseProfileStatItemEntity)
    private readonly profileStatItemRepo: Repository<EnterpriseProfileStatItemEntity>,
    @InjectRepository(EnterprisePropertyRecordEntity)
    private readonly propertyRepo: Repository<EnterprisePropertyRecordEntity>,
    @InjectRepository(EnterpriseTeacherEntity)
    private readonly teacherRepo: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(EnterpriseUserEntity)
    private readonly enterpriseUserRepo: Repository<EnterpriseUserEntity>,
    @InjectRepository(OperationLogEntity)
    private readonly operationLogRepo: Repository<OperationLogEntity>,
    @InjectRepository(PolicyProjectEntity)
    private readonly policyProjectRepo: Repository<PolicyProjectEntity>,
    @InjectRepository(RegionPolicyFileEntity)
    private readonly policyFileRepo: Repository<RegionPolicyFileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly policyCollectService: PolicyCollectService,
  ) {}

  async getAdminAnalytics(user: CurrentUser) {
    this.assertAdminPortal(user);
    const scope = await this.resolveAdminEnterpriseScope(user);
    const [
      enterpriseTotal,
      activeEnterpriseTotal,
      enterpriseUserTotal,
      systemUserTotal,
      policyProjectTotal,
      policyFileTotal,
      declarationTotal,
      profileStatusStats,
      policyStatusStats,
      declarationStatusStats,
      enterpriseTrend,
      activityTrend,
      tableRows,
    ] = await Promise.all([
      this.countEnterprises(scope),
      this.countEnterprises(scope, { status: 1 }),
      this.countEnterpriseUsers(scope),
      this.countSystemUsers(scope),
      this.policyProjectRepo.count({ where: { enabled: 1 } }),
      this.policyFileRepo.count(),
      this.countDeclarations(scope),
      this.groupEnterpriseStatus(scope),
      this.groupPolicyStatus(),
      this.groupDeclarationStatus(scope),
      this.groupEnterpriseTrend(scope),
      this.groupActivityTrend(user, scope),
      this.getAdminEnterpriseRows(scope),
    ]);

    const activeRate =
      enterpriseTotal === 0 ? 0 : Math.round((activeEnterpriseTotal / enterpriseTotal) * 100);

    return {
      activityTrend,
      declarationStatusStats,
      enterpriseTrend,
      overview: [
        {
          hint: `启用企业 ${activeEnterpriseTotal} 家，启用率 ${activeRate}%`,
          key: 'enterpriseTotal',
          label: '企业总数量',
          value: enterpriseTotal,
        },
        {
          hint: `企业端账号 ${enterpriseUserTotal} 个`,
          key: 'systemUserTotal',
          label: scope.scoped ? '负责企业账号' : '系统用户',
          value: systemUserTotal,
        },
        {
          hint: `政策项目 ${policyProjectTotal} 个`,
          key: 'policyFileTotal',
          label: '政策文件',
          value: policyFileTotal,
        },
        {
          hint: `当前可见申报记录`,
          key: 'declarationTotal',
          label: '申报项目',
          value: declarationTotal,
        },
      ],
      policyStatusStats,
      profileStatusStats,
      scope,
      tableRows,
    };
  }

  async getAdminWorkbench(user: CurrentUser) {
    this.assertAdminPortal(user);
    const scope = await this.resolveAdminEnterpriseScope(user);
    const [
      enterpriseTotal,
      policyFileTotal,
      declarationStatusStats,
      profileStats,
      profileTodoRows,
      declarationTodoRows,
      materialIssueTotal,
      policyTodoTotal,
      collectSummary,
    ] = await Promise.all([
      this.countEnterprises(scope),
      this.policyFileRepo.count(),
      this.groupDeclarationStatus(scope),
      this.findProfileStats(scope),
      this.getAdminProfileTodos(scope),
      this.getAdminDeclarationTodos(scope),
      this.countMaterialIssues(scope),
      this.policyFileRepo.count({ where: { status: In(['draft', 'incomplete']) } }),
      this.buildAdminCollectSummary(user),
    ]);

    const avgCompleteness = this.average(
      profileStats.map((item) => this.toNumber(item.completenessRate)),
    );
    const pendingDeclarationTotal = declarationStatusStats
      .filter((item) => ['draft', 'preparing', 'rejected'].includes(item.label))
      .reduce((sum, item) => sum + item.value, 0);

    return {
      notificationSummary: {
        description:
          collectSummary.unreadNotificationCount > 0
            ? `当前有 ${collectSummary.unreadNotificationCount} 条政策采集提醒待处理`
            : '当前没有新的政策采集提醒',
        items: collectSummary.notifications,
        unread: collectSummary.unreadNotificationCount,
      },
      overview: [
        {
          hint: `平均资料完整度 ${avgCompleteness}%`,
          key: 'enterpriseTotal',
          label: scope.scoped ? '负责企业' : '企业总数',
          value: enterpriseTotal,
        },
        {
          hint: `待处理申报 ${pendingDeclarationTotal} 个`,
          key: 'declarationPending',
          label: '申报进度',
          value: pendingDeclarationTotal,
        },
        {
          hint: `政策文件不按负责人划分`,
          key: 'policyFileTotal',
          label: '政策文件',
          value: policyFileTotal,
        },
        {
          hint: `资料/材料/申报待处理`,
          key: 'todoTotal',
          label: '工作待办',
          value: profileTodoRows.length + declarationTodoRows.length + materialIssueTotal,
        },
      ],
      quickEntries: [
        { icon: 'lucide:building-2', label: '企业资料', path: '/enterprise/profile' },
        { icon: 'lucide:file-text', label: '政策文件', path: '/policy/files' },
        { icon: 'lucide:list-checks', label: '政策项目', path: '/policy/projects' },
        { icon: 'lucide:sparkles', label: 'AI 分析', path: '/Dashboard/AiAnalysis' },
      ],
      policyCollectSummary: collectSummary.policyCollectSummary,
      syncSummary: {
        description:
          collectSummary.runningSyncCount > 0
            ? `当前有 ${collectSummary.runningSyncCount} 个政策采集任务正在执行`
            : collectSummary.failedSyncCount > 0
              ? `有 ${collectSummary.failedSyncCount} 个政策采集任务执行失败`
              : '最近没有进行中的政策采集任务',
        failed: collectSummary.failedSyncCount,
        items: collectSummary.syncItems,
        running: collectSummary.runningSyncCount,
      },
      todoItems: [
        ...profileTodoRows,
        ...declarationTodoRows,
      ].slice(0, 10),
      workProgress: [
        {
          key: 'profile',
          label: '企业资料平均完整度',
          percent: avgCompleteness,
          value: `${avgCompleteness}%`,
        },
        {
          key: 'declaration',
          label: '待推进申报',
          percent: this.percent(pendingDeclarationTotal, Math.max(pendingDeclarationTotal + 5, 1)),
          value: `${pendingDeclarationTotal} 个`,
        },
        {
          key: 'material',
          label: '材料异常',
          percent: this.percent(materialIssueTotal, Math.max(materialIssueTotal + 5, 1)),
          value: `${materialIssueTotal} 项`,
        },
        {
          key: 'policy',
          label: '待完善政策文件',
          percent: this.percent(policyTodoTotal, Math.max(policyFileTotal, 1)),
          value: `${policyTodoTotal} 份`,
        },
      ],
    };
  }

  async getClientAnalytics(user: CurrentUser) {
    const enterprise = await this.resolveClientEnterprise(user);
    const enterpriseId = String(enterprise.id);
    const [
      profileStat,
      profileItems,
      materials,
      declarations,
      financeRecords,
      employees,
      properties,
    ] = await Promise.all([
      this.profileStatRepo.findOne({ where: { enterpriseId } }),
      this.profileStatItemRepo.find({ order: { id: 'ASC' }, where: { enterpriseId } }),
      this.materialRepo.find({ where: { enterpriseId } }),
      this.declarationRepo.find({ order: { id: 'DESC' }, where: { enterpriseId } }),
      this.financeRepo.find({ where: { enterpriseId, recordType: 'financial', status: 1 } }),
      this.employeeRepo.find({ where: { enterpriseId, status: 1 } }),
      this.propertyRepo.find({ where: { enterpriseId, status: 1 } }),
    ]);

    const materialIssueTotal = materials.filter((item) =>
      ['invalid', 'not_uploaded'].includes(item.status),
    ).length;
    const readiness = this.buildReadiness(profileItems);

    return {
      company: this.toCompany(enterprise),
      declarationStats: this.countStatus(declarations.map((item) => item.status)),
      employeeStats: this.buildEmployeeStats(employees),
      financeGrowthTrend: this.buildFinanceGrowthTrend(financeRecords),
      materialStats: this.countStatus(materials.map((item) => item.status)),
      overview: [
        {
          hint: `${profileStat?.completedModules ?? 0}/${profileStat?.totalModules ?? 0} 个模块完成`,
          key: 'completenessRate',
          label: '资料完整度',
          value: `${this.toNumber(profileStat?.completenessRate)}%`,
        },
        {
          hint: `科技研发人员 ${employees.filter((item) => item.isKjyf === 1).length} 人`,
          key: 'employeeTotal',
          label: '员工总数',
          value: employees.length,
        },
        {
          hint: `异常或未上传 ${materialIssueTotal} 项`,
          key: 'materialTotal',
          label: '企业材料',
          value: materials.length,
        },
        {
          hint: readiness.summary,
          key: 'readiness',
          label: '高企准备度',
          value: `${readiness.readinessRate}%`,
        },
      ],
      profileItems: profileItems.map((item) => this.toProfileItem(item)),
      profileStat: this.toProfileStat(profileStat, profileItems),
      propertyStats: this.countStatus(properties.map((item) => item.recordType)),
      recentDeclarations: declarations.slice(0, 8).map((item) => this.toDeclarationItem(item)),
    };
  }

  async getClientWorkbench(user: CurrentUser) {
    const analytics = await this.getClientAnalytics(user);
    const todos = await this.getClientTodos(user);
    const syncSummary = await this.buildClientSyncSummary(analytics.company.id);
    const notificationItems = todos.items.slice(0, 6).map((item) =>
      this.toClientNotificationItem(item),
    );

    return {
      company: analytics.company,
      notificationSummary: {
        description:
          notificationItems.length > 0
            ? `当前企业有 ${notificationItems.length} 条待处理提醒`
            : '当前企业暂无新的资料或申报提醒',
        items: notificationItems,
        unread: notificationItems.length,
      },
      overview: analytics.overview,
      quickEntries: [
        { icon: 'lucide:building-2', label: '企业资料', path: '/client/company' },
        { icon: 'lucide:upload-cloud', label: '材料中心', path: '/client/company/materials' },
        { icon: 'lucide:area-chart', label: '数据分析', path: '/dashboard/analytics' },
        { icon: 'lucide:clipboard-check', label: '待办事项', path: '/tasks' },
        { icon: 'lucide:file-search', label: '政策库', path: '/policy/library' },
        { icon: 'lucide:list-checks', label: '我的申报', path: '/projects/my' },
      ],
      syncSummary,
      todoPreview: todos.items.slice(0, 8),
      workProgress: [
        {
          key: 'profile',
          label: '资料完整度',
          percent: analytics.profileStat.completenessRate,
          value: `${analytics.profileStat.completenessRate}%`,
        },
        {
          key: 'readiness',
          label: '高企准备度',
          percent: analytics.profileStat.highTechReadiness.readinessRate,
          value: `${analytics.profileStat.highTechReadiness.readinessRate}%`,
        },
        {
          key: 'material',
          label: '材料有效率',
          percent: this.percent(
            analytics.materialStats.find((item) => item.label === 'valid')?.value ?? 0,
            analytics.materialStats.reduce((sum, item) => sum + item.value, 0),
          ),
          value: '按材料状态统计',
        },
      ],
    };
  }

  async getClientTodos(user: CurrentUser) {
    const enterprise = await this.resolveClientEnterprise(user);
    const enterpriseId = String(enterprise.id);
    const [profileItems, materials, declarations] = await Promise.all([
      this.profileStatItemRepo.find({ order: { score: 'ASC' }, where: { enterpriseId } }),
      this.materialRepo.find({ order: { id: 'DESC' }, where: { enterpriseId } }),
      this.declarationRepo.find({ order: { id: 'DESC' }, where: { enterpriseId } }),
    ]);

    const profileTodos = profileItems
      .filter((item) => item.isCompleted !== 1)
      .map((item) => ({
        actionText: '完善资料',
        category: 'profile',
        description:
          this.parseStringArray(item.missingFields).length > 0
            ? `缺少：${this.parseStringArray(item.missingFields).slice(0, 3).join('、')}`
            : item.summary ?? '该资料模块尚未达到最低记录要求',
        key: `profile-${item.moduleKey}-${item.tabKey}-${item.id}`,
        moduleKey: item.moduleKey,
        priority: this.toNumber(item.score) < 60 ? 'high' : 'medium',
        priorityReason:
          this.toNumber(item.score) < 60
            ? `资料得分 ${this.toNumber(item.score)}，低于关键处理线`
            : `资料得分 ${this.toNumber(item.score)}，建议补齐后刷新统计`,
        routePath: this.moduleRoute(item.moduleKey, item.tabKey),
        source: '企业资料',
        tabKey: item.tabKey,
        title: item.itemName || item.moduleName,
      }));

    const materialTodos = materials
      .filter((item) => ['invalid', 'not_uploaded'].includes(item.status))
      .map((item) => ({
        actionText: item.status === 'invalid' ? '查看错误' : '上传材料',
        category: 'material',
        description:
          item.status === 'invalid'
            ? `${item.errorCount ?? 0} 条解析错误需要处理`
            : item.templateName || item.fileName || '模板材料尚未上传',
        key: `material-${item.id}`,
        moduleKey: 'material',
        priority: item.status === 'invalid' ? 'high' : 'medium',
        priorityReason:
          item.status === 'invalid'
            ? '材料解析失败，需要先处理错误行'
            : '模板材料尚未上传',
        routePath: '/client/company/materials',
        source: '材料中心',
        tabKey: String(item.templateId ?? item.id ?? ''),
        title: item.templateName || item.fileName || '企业材料',
      }));

    const declarationTodos = declarations
      .filter(
        (item) =>
          ['draft', 'preparing', 'rejected'].includes(item.status) ||
          item.missingMaterialCount > 0,
      )
      .map((item) => ({
        actionText: '处理申报',
        category: 'declaration',
        description:
          item.missingMaterialCount > 0
            ? `缺少 ${item.missingMaterialCount} 项申报材料`
            : item.rejectedReason || item.currentNodeName || '申报流程待推进',
        key: `declaration-${item.id}`,
        moduleKey: 'declaration',
        priority: item.status === 'rejected' ? 'high' : 'medium',
        priorityReason:
          item.status === 'rejected'
            ? '申报已退回，需要优先处理'
            : item.missingMaterialCount > 0
              ? `还有 ${item.missingMaterialCount} 项申报材料未补齐`
              : item.currentNodeName || '申报流程待推进',
        routePath: `/projects/my/detail/${item.id}`,
        source: '申报项目',
        tabKey: String(item.id),
        title: item.projectName,
      }));

    const items = [...profileTodos, ...materialTodos, ...declarationTodos];
    return {
      company: this.toCompany(enterprise),
      items,
      summary: {
        all: items.length,
        declaration: declarationTodos.length,
        high: items.filter((item) => item.priority === 'high').length,
        material: materialTodos.length,
        profile: profileTodos.length,
      },
    };
  }

  private async buildAdminCollectSummary(user: CurrentUser) {
    const [
      policyCollectSummary,
      notificationResult,
      recentRunResult,
      runningRunResult,
      failedRunResult,
    ] = await Promise.all([
      this.policyCollectService.getWorkbenchSummary(user),
      this.policyCollectService.listNotifications({ page: '1', pageSize: '6' }, user),
      this.policyCollectService.listRuns({ page: '1', pageSize: '6' }, user),
      this.policyCollectService.listRuns(
        { page: '1', pageSize: '1', status: 'running' },
        user,
      ),
      this.policyCollectService.listRuns(
        { page: '1', pageSize: '1', status: 'failed' },
        user,
      ),
    ]);

    const notifications = notificationResult.items.map((item) =>
      this.toAdminNotificationItem(
        item as {
          content?: null | string;
          createTime?: string;
          id: string;
          status?: string;
          title: string;
          type?: string;
        },
      ),
    );
    const syncItems = recentRunResult.items.map((item) =>
      this.toAdminSyncItem(
        item as {
          changedCount?: number;
          currentStep?: null | string;
          errorMessage?: null | string;
          finishedAt?: null | string;
          id: string;
          jobId?: string;
          jobName: string;
          newCount?: number;
          progress?: number;
          startedAt?: null | string;
          status?: string;
          stepMessage?: null | string;
          totalCount?: number;
          uncertainCount?: number;
          updateTime?: string;
        },
      ),
    );

    return {
      failedSyncCount: failedRunResult.total,
      notifications,
      policyCollectSummary,
      runningSyncCount: runningRunResult.total,
      syncItems,
      unreadNotificationCount: policyCollectSummary.unreadNotificationCount,
    };
  }

  private async buildClientSyncSummary(enterpriseId: string) {
    const [runningCount, failedCount, rows] = await Promise.all([
      this.materialRepo.count({ where: { enterpriseId, status: 'uploaded' } }),
      this.materialRepo.count({ where: { enterpriseId, status: 'invalid' } }),
      this.materialRepo.find({
        order: { updatedAt: 'DESC' },
        take: 6,
        where: {
          enterpriseId,
          status: In(['uploaded', 'invalid', 'valid']),
        },
      }),
    ]);

    return {
      description:
        runningCount > 0
          ? `当前有 ${runningCount} 份材料等待系统校验`
          : failedCount > 0
            ? `有 ${failedCount} 份材料校验失败，等待修正`
            : '最近没有进行中的材料同步任务',
      failed: failedCount,
      items: rows.map((row) => this.toClientSyncItem(row)),
      running: runningCount,
    };
  }

  private assertAdminPortal(user: CurrentUser): void {
    if (user.portal && user.portal !== 'admin') {
      throw new ForbiddenException('当前账号不能访问后台看板');
    }
  }

  private async resolveAdminEnterpriseScope(user: CurrentUser): Promise<EnterpriseScope> {
    const scoped =
      user.roles.includes('project_teacher') &&
      !user.roles.includes('admin') &&
      !user.roles.includes('super_admin');
    if (!scoped) {
      return { scoped: false };
    }

    const rows = await this.teacherRepo.find({
      select: { enterpriseId: true },
      where: { status: 1, teacherUserId: String(user.id) },
    });
    return {
      ids: rows.map((item) => String(item.enterpriseId)),
      scoped: true,
    };
  }

  private applyEnterpriseScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    scope: EnterpriseScope,
    alias: string,
    column = 'enterpriseId',
  ): SelectQueryBuilder<T> {
    if (!scope.scoped) {
      return qb;
    }
    if (!scope.ids?.length) {
      return qb.andWhere('1 = 0');
    }
    return qb.andWhere(`${alias}.${column} IN (:...enterpriseIds)`, {
      enterpriseIds: scope.ids,
    });
  }

  private scopedWhere(scope: EnterpriseScope, extra: Record<string, unknown> = {}) {
    if (!scope.scoped) {
      return extra;
    }
    if (!scope.ids?.length) {
      return null;
    }
    return {
      ...extra,
      enterpriseId: In(scope.ids),
    };
  }

  private async countEnterprises(scope: EnterpriseScope, extra: Record<string, unknown> = {}) {
    if (!scope.scoped) {
      return this.enterpriseRepo.count({ where: extra });
    }
    if (!scope.ids?.length) {
      return 0;
    }
    return this.enterpriseRepo.count({ where: { ...extra, id: In(scope.ids) } });
  }

  private async countEnterpriseUsers(scope: EnterpriseScope) {
    const where = this.scopedWhere(scope, { status: 1 });
    return where ? this.enterpriseUserRepo.count({ where }) : 0;
  }

  private async countSystemUsers(scope: EnterpriseScope) {
    if (!scope.scoped) {
      return this.userRepo.count();
    }
    return this.countEnterpriseUsers(scope);
  }

  private async countDeclarations(scope: EnterpriseScope) {
    const where = this.scopedWhere(scope);
    return where ? this.declarationRepo.count({ where }) : 0;
  }

  private async countMaterialIssues(scope: EnterpriseScope) {
    const where = this.scopedWhere(scope, {
      status: In(['invalid', 'not_uploaded']),
    });
    return where ? this.materialRepo.count({ where }) : 0;
  }

  private async groupEnterpriseStatus(scope: EnterpriseScope): Promise<CountItem[]> {
    const qb = this.enterpriseRepo
      .createQueryBuilder('enterprise')
      .select('enterprise.profileStatus', 'label')
      .addSelect('COUNT(*)', 'value')
      .groupBy('enterprise.profileStatus');
    this.applyEnterpriseScope(qb, scope, 'enterprise', 'id');
    return this.toCountItems(await qb.getRawMany<{ label: string; value: string }>());
  }

  private async groupPolicyStatus(): Promise<CountItem[]> {
    const rows = await this.policyFileRepo
      .createQueryBuilder('policy')
      .select('policy.status', 'label')
      .addSelect('COUNT(*)', 'value')
      .groupBy('policy.status')
      .getRawMany<{ label: string; value: string }>();
    return this.toCountItems(rows);
  }

  private async groupDeclarationStatus(scope: EnterpriseScope): Promise<CountItem[]> {
    const qb = this.declarationRepo
      .createQueryBuilder('declaration')
      .select('declaration.status', 'label')
      .addSelect('COUNT(*)', 'value')
      .groupBy('declaration.status');
    this.applyEnterpriseScope(qb, scope, 'declaration');
    return this.toCountItems(await qb.getRawMany<{ label: string; value: string }>());
  }

  private async groupEnterpriseTrend(scope: EnterpriseScope): Promise<CountItem[]> {
    const start = this.addMonths(new Date(), -11);
    const qb = this.enterpriseRepo
      .createQueryBuilder('enterprise')
      .select("DATE_FORMAT(enterprise.createdAt, '%Y-%m')", 'label')
      .addSelect('COUNT(*)', 'value')
      .where('enterprise.createdAt >= :start', { start })
      .groupBy("DATE_FORMAT(enterprise.createdAt, '%Y-%m')")
      .orderBy('label', 'ASC');
    this.applyEnterpriseScope(qb, scope, 'enterprise', 'id');
    return this.fillMonthSeries(
      this.toCountItems(await qb.getRawMany<{ label: string; value: string }>()),
      12,
    );
  }

  private async groupActivityTrend(
    user: CurrentUser,
    scope: EnterpriseScope,
  ): Promise<Array<{ failed: number; label: string; success: number; value: number }>> {
    const start = this.addDays(new Date(), -13);
    const qb = this.operationLogRepo
      .createQueryBuilder('log')
      .select("DATE_FORMAT(log.createdAt, '%Y-%m-%d')", 'label')
      .addSelect('COUNT(*)', 'value')
      .addSelect('SUM(CASE WHEN log.success = 1 THEN 1 ELSE 0 END)', 'success')
      .addSelect('SUM(CASE WHEN log.success = 1 THEN 0 ELSE 1 END)', 'failed')
      .where('log.createdAt >= :start', { start })
      .andWhere("LOWER(CONCAT(IFNULL(log.module, ''), ' ', IFNULL(log.action, ''), ' ', IFNULL(log.requestPath, ''))) NOT LIKE :login", { login: '%login%' })
      .andWhere("LOWER(CONCAT(IFNULL(log.module, ''), ' ', IFNULL(log.action, ''), ' ', IFNULL(log.requestPath, ''))) NOT LIKE :register", { register: '%register%' })
      .andWhere("LOWER(CONCAT(IFNULL(log.module, ''), ' ', IFNULL(log.action, ''), ' ', IFNULL(log.requestPath, ''))) NOT LIKE :auth", { auth: '%auth%' })
      .andWhere("LOWER(CONCAT(IFNULL(log.module, ''), ' ', IFNULL(log.action, ''), ' ', IFNULL(log.requestPath, ''))) NOT LIKE :token", { token: '%token%' })
      .andWhere("CONCAT(IFNULL(log.module, ''), ' ', IFNULL(log.action, ''), ' ', IFNULL(log.requestPath, '')) NOT LIKE :loginCn", { loginCn: '%登录%' })
      .andWhere("CONCAT(IFNULL(log.module, ''), ' ', IFNULL(log.action, ''), ' ', IFNULL(log.requestPath, '')) NOT LIKE :registerCn", { registerCn: '%注册%' })
      .groupBy("DATE_FORMAT(log.createdAt, '%Y-%m-%d')")
      .orderBy('label', 'ASC');

    if (scope.scoped) {
      qb.andWhere('log.userId = :userId', { userId: String(user.id) });
    }

    const rows = await qb.getRawMany<{
      failed: string;
      label: string;
      success: string;
      value: string;
    }>();
    const map = new Map(rows.map((item) => [item.label, item]));
    return Array.from({ length: 14 }).map((_, index) => {
      const date = this.formatDate(this.addDays(new Date(), index - 13));
      const row = map.get(date);
      return {
        failed: Number(row?.failed ?? 0),
        label: date,
        success: Number(row?.success ?? 0),
        value: Number(row?.value ?? 0),
      };
    });
  }

  private async getAdminEnterpriseRows(scope: EnterpriseScope) {
    const qb = this.enterpriseRepo
      .createQueryBuilder('enterprise')
      .orderBy('enterprise.updatedAt', 'DESC')
      .take(8);
    this.applyEnterpriseScope(qb, scope, 'enterprise', 'id');
    const enterprises = await qb.getMany();
    const ids = enterprises.map((item) => String(item.id));
    const [stats, declarations] = ids.length
      ? await Promise.all([
          this.profileStatRepo.find({ where: { enterpriseId: In(ids) } }),
          this.declarationRepo.find({ where: { enterpriseId: In(ids) } }),
        ])
      : [[], []];
    const statMap = new Map(stats.map((item) => [String(item.enterpriseId), item]));

    return enterprises.map((enterprise) => ({
      completenessRate: this.toNumber(
        statMap.get(String(enterprise.id))?.completenessRate,
      ),
      declarationCount: declarations.filter(
        (item) => String(item.enterpriseId) === String(enterprise.id),
      ).length,
      id: String(enterprise.id),
      industry: enterprise.industry,
      name: enterprise.name,
      profileStatus: enterprise.profileStatus,
      status: enterprise.status,
      updateTime: formatDateTimeInBjt(enterprise.updatedAt),
    }));
  }

  private async findProfileStats(scope: EnterpriseScope) {
    const where = this.scopedWhere(scope);
    return where ? this.profileStatRepo.find({ where }) : [];
  }

  private async getAdminProfileTodos(scope: EnterpriseScope) {
    const qb = this.enterpriseRepo
      .createQueryBuilder('enterprise')
      .leftJoin(
        EnterpriseProfileStatEntity,
        'stat',
        'stat.enterpriseId = enterprise.id',
      )
      .select('enterprise.id', 'enterpriseId')
      .addSelect('enterprise.name', 'title')
      .addSelect('enterprise.profileStatus', 'profileStatus')
      .addSelect('stat.completenessRate', 'completenessRate')
      .where(
        "(enterprise.profileStatus IN (:...statuses) OR IFNULL(stat.completenessRate, 0) < 80)",
        { statuses: ['draft', 'need_resubmit', 'rejected'] },
      )
      .orderBy('enterprise.updatedAt', 'DESC')
      .take(8);
    this.applyEnterpriseScope(qb, scope, 'enterprise', 'id');

    const rows = await qb.getRawMany<{
      completenessRate: null | string;
      enterpriseId: string;
      profileStatus: string;
      title: string;
    }>();
    return rows.map((item) => ({
      actionText: '查看企业',
      description: `资料完整度 ${this.toNumber(item.completenessRate)}%，状态 ${this.profileStatusLabel(item.profileStatus)}`,
      key: `enterprise-${item.enterpriseId}`,
      priority: this.toNumber(item.completenessRate) < 60 ? 'high' : 'medium',
      routePath: `/enterprise/profile?enterpriseId=${encodeURIComponent(String(item.enterpriseId))}&from=admin-workbench`,
      source: '企业资料',
      title: item.title,
    }));
  }

  private async getAdminDeclarationTodos(scope: EnterpriseScope) {
    const qb = this.declarationRepo
      .createQueryBuilder('declaration')
      .where(
        '(declaration.status IN (:...statuses) OR declaration.missingMaterialCount > 0)',
        { statuses: ['draft', 'preparing', 'rejected'] },
      )
      .orderBy('declaration.updatedAt', 'DESC')
      .take(8);
    this.applyEnterpriseScope(qb, scope, 'declaration');
    const rows = await qb.getMany();
    return rows.map((item) => ({
      actionText: '处理申报',
      description:
        item.missingMaterialCount > 0
          ? `缺少 ${item.missingMaterialCount} 项材料`
          : item.rejectedReason || item.currentNodeName || item.status,
      key: `declaration-${item.id}`,
      priority: item.status === 'rejected' ? 'high' : 'medium',
      routePath: `/enterprise/profile?enterpriseId=${encodeURIComponent(String(item.enterpriseId))}&declarationId=${encodeURIComponent(String(item.id))}&from=admin-workbench`,
      source: '申报项目',
      title: `${item.enterpriseName} / ${item.projectName}`,
    }));
  }

  private toAdminNotificationItem(item: {
    content?: null | string;
    createTime?: string;
    id: string;
    status?: string;
    title: string;
    type?: string;
  }): DashboardNotificationItem {
    const type = item.type ?? 'policy_notice';
    const isRunNotification = ['no_result', 'run_failed'].includes(type);
    return {
      actionPath: isRunNotification ? '/policy/collect-runs' : '/policy/collect-review',
      actionText: isRunNotification ? '查看执行' : '去审核',
      content: item.content?.trim() || '政策采集有新的处理进展，请及时查看。',
      id: item.id,
      level: type === 'run_failed' ? 'high' : type === 'uncertain' ? 'medium' : 'low',
      status: item.status === 'read' ? 'read' : 'unread',
      time: item.createTime || '刚刚',
      title: item.title,
    };
  }

  private toAdminSyncItem(item: {
    changedCount?: number;
    currentStep?: null | string;
    errorMessage?: null | string;
    finishedAt?: null | string;
    id: string;
    jobId?: string;
    jobName: string;
    newCount?: number;
    progress?: number;
    startedAt?: null | string;
    status?: string;
    stepMessage?: null | string;
    totalCount?: number;
    uncertainCount?: number;
    updateTime?: string;
  }): DashboardSyncItem {
    const status = item.status ?? 'queued';
    const progress = this.toNumber(item.progress);
    const summaryText =
      status === 'failed'
        ? item.errorMessage || item.stepMessage || '采集执行失败，请查看原因。'
        : item.stepMessage ||
          `本次共处理 ${this.toNumber(item.totalCount)} 条候选，新增 ${this.toNumber(item.newCount)} 条，疑似变更 ${this.toNumber(item.changedCount)} 条，待确认 ${this.toNumber(item.uncertainCount)} 条。`;

    return {
      actionPath: '/policy/collect-runs',
      actionText: status === 'failed' ? '查看失败' : '查看执行',
      currentStep: item.currentStep ?? null,
      description: summaryText,
      id: item.id,
      jobId: item.jobId ? String(item.jobId) : '',
      progress,
      runId: item.id,
      status,
      time: item.finishedAt || item.startedAt || item.updateTime || '刚刚',
      title: item.jobName,
    };
  }

  private toClientNotificationItem(item: {
    actionText: string;
    description: string;
    key: string;
    priority: string;
    routePath: string;
    source: string;
    title: string;
  }): DashboardNotificationItem {
    return {
      actionPath: item.routePath,
      actionText: item.actionText,
      content: `${item.source}：${item.description}`,
      id: item.key,
      level: this.normalizePriority(item.priority),
      status: 'unread',
      time: '待处理事项',
      title: item.title,
    };
  }

  private toClientSyncItem(row: EnterpriseMaterialEntity): DashboardSyncItem {
    const status =
      row.status === 'invalid'
        ? 'failed'
        : row.status === 'uploaded'
          ? 'running'
          : 'success';
    const title = row.templateName || row.fileName || '企业材料';
    const description =
      status === 'failed'
        ? `${title}校验失败，${row.errorCount ?? 0} 条错误待处理。`
        : status === 'running'
          ? `${title}已上传，系统正在进行解析和校验。`
          : `${title}已完成上传并通过系统校验。`;

    return {
      actionPath: '/client/company/materials',
      actionText: status === 'failed' ? '查看错误' : '查看材料',
      currentStep:
        status === 'failed'
          ? '校验失败'
          : status === 'running'
            ? '等待校验'
            : '校验通过',
      description,
      id: String(row.id),
      jobId: '',
      progress: status === 'running' ? 60 : 100,
      runId: String(row.id),
      status,
      time: formatDateTimeInBjt(row.updatedAt),
      title,
    };
  }

  private async resolveClientEnterprise(user: CurrentUser): Promise<EnterpriseEntity> {
    if (user.portal && user.portal !== 'client') {
      throw new ForbiddenException('当前账号不能访问客户端看板');
    }

    const userId = String(user.id);
    const [profile, ownerBindings, teacherBindings, userBindings] = await Promise.all([
      this.clientUserProfileRepo.findOne({ where: { userId } }),
      this.ownerRepo.find({
        relations: { enterprise: true },
        where: { status: 1, userId },
      }),
      this.teacherRepo.find({
        relations: { enterprise: true },
        where: { status: 1, teacherUserId: userId },
      }),
      this.enterpriseUserRepo.find({
        order: { isDefault: 'DESC', id: 'ASC' },
        relations: { enterprise: true },
        where: { status: 1, userId },
      }),
    ]);

    const companies = [
      ...ownerBindings.map((item) => item.enterprise),
      ...teacherBindings.map((item) => item.enterprise),
      ...userBindings.map((item) => item.enterprise),
    ]
      .filter((item): item is EnterpriseEntity => Boolean(item && item.status === 1))
      .filter(
        (item, index, array) =>
          array.findIndex((candidate) => String(candidate.id) === String(item.id)) ===
          index,
      );
    if (!companies.length) {
      throw new NotFoundException('当前账号未绑定企业');
    }

    const current = profile?.currentEnterpriseId
      ? companies.find((item) => String(item.id) === String(profile.currentEnterpriseId))
      : null;

    return current ?? companies[0];
  }

  private toCompany(enterprise: EnterpriseEntity) {
    return {
      creditCode: enterprise.creditCode,
      id: String(enterprise.id),
      industry: enterprise.industry,
      name: enterprise.name,
      profileStatus: enterprise.profileStatus,
      shortName: enterprise.shortName,
      status: enterprise.status,
    };
  }

  private toProfileStat(
    stat: EnterpriseProfileStatEntity | null,
    items: EnterpriseProfileStatItemEntity[],
  ) {
    const readiness = this.buildReadiness(items);
    return {
      attachmentRecords: stat?.attachmentRecords ?? 0,
      calculatedAt: stat?.calculatedAt ? formatDateTimeInBjt(stat.calculatedAt) : null,
      completedModules: stat?.completedModules ?? 0,
      completenessRate: this.toNumber(stat?.completenessRate),
      enterpriseId: stat?.enterpriseId ? String(stat.enterpriseId) : null,
      healthScore: this.toNumber(stat?.healthScore),
      highTechReadiness: readiness,
      items: items.map((item) => this.toProfileItem(item)),
      missingModules: this.parseJson(stat?.missingModules, []),
      totalModules: stat?.totalModules ?? 0,
      totalRecords: stat?.totalRecords ?? 0,
    };
  }

  private toProfileItem(item: EnterpriseProfileStatItemEntity) {
    return {
      attachmentCount: item.attachmentCount,
      isCompleted: item.isCompleted === 1,
      itemName: item.itemName,
      missingFields: this.parseStringArray(item.missingFields),
      moduleKey: item.moduleKey,
      moduleName: item.moduleName,
      recordCount: item.recordCount,
      requiredMinCount: item.requiredMinCount,
      score: this.toNumber(item.score),
      summary: item.summary,
      tabKey: item.tabKey,
    };
  }

  private toDeclarationItem(item: ClientDeclarationEntity) {
    return {
      companyId: String(item.enterpriseId),
      currentNodeName: item.currentNodeName,
      deadline: item.deadline ? this.formatDate(item.deadline) : null,
      declarationNo: item.declarationNo,
      id: String(item.id),
      missingMaterialCount: item.missingMaterialCount,
      policyType: item.policyType,
      progress: item.progress,
      projectId: String(item.projectId),
      projectName: item.projectName,
      rejectedReason: item.rejectedReason,
      status: item.status,
      submitTime: item.submitTime ? formatDateTimeInBjt(item.submitTime) : null,
      updateTime: formatDateTimeInBjt(item.updatedAt),
    };
  }

  private buildReadiness(items: EnterpriseProfileStatItemEntity[]) {
    const totalItems = items.length;
    const readyItems = items.filter((item) => item.isCompleted === 1).length;
    const readinessRate = this.percent(readyItems, totalItems);
    const gaps = items
      .filter((item) => item.isCompleted !== 1)
      .sort((left, right) => this.toNumber(left.score) - this.toNumber(right.score))
      .slice(0, 8)
      .map((item) => ({
        actionText: '补充资料',
        blocking: this.toNumber(item.score) < 60,
        description:
          this.parseStringArray(item.missingFields).length > 0
            ? `缺少：${this.parseStringArray(item.missingFields).slice(0, 3).join('、')}`
            : item.summary ?? '资料项未达到申报要求',
        itemName: item.itemName,
        moduleKey: item.moduleKey,
        tabKey: item.tabKey,
      }));

    return {
      gaps,
      readinessRate,
      readyItems,
      status:
        readinessRate >= 85 ? 'ready' : readinessRate >= 60 ? 'needs_completion' : 'high_risk',
      summary:
        totalItems === 0
          ? '暂无企业资料统计'
          : `已完成 ${readyItems}/${totalItems} 个关键资料项`,
      totalItems,
    };
  }

  private buildFinanceGrowthTrend(records: EnterpriseFinanceRecordEntity[]) {
    const grouped = new Map<
      string,
      { highTechIncome: number; netAssets: number; netProfit: number; rdExpense: number; revenue: number; year: string }
    >();
    records.forEach((item) => {
      const year = item.year || '未填年度';
      const current =
        grouped.get(year) ??
        {
          highTechIncome: 0,
          netAssets: 0,
          netProfit: 0,
          rdExpense: 0,
          revenue: 0,
          year,
        };
      current.revenue += this.toNumber(item.totalRevenue);
      current.netProfit += this.toNumber(item.netProfit);
      current.netAssets += this.toNumber(item.netAssets);
      current.rdExpense += this.toNumber(item.yffy);
      current.highTechIncome += this.toNumber(item.highTechIncome);
      grouped.set(year, current);
    });
    return [...grouped.values()].sort((left, right) => left.year.localeCompare(right.year));
  }

  private buildEmployeeStats(records: EnterpriseEmployeeRecordEntity[]) {
    return {
      activeTotal: records.filter((item) => item.isActive === 1).length,
      educationStats: this.countStatus(records.map((item) => String(item.ygXl ?? '未填'))),
      rdStaffTotal: records.filter((item) => item.isKjyf === 1).length,
      titleStats: this.countStatus(records.map((item) => String(item.ygZc ?? '未填'))),
      total: records.length,
    };
  }

  private countStatus(values: Array<null | string | undefined>): CountItem[] {
    const map = new Map<string, number>();
    values.forEach((value) => {
      const label = value || '未填';
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }

  private toCountItems(rows: Array<{ label: null | string; value: number | string }>): CountItem[] {
    return rows.map((item) => ({
      label: item.label ?? '未填',
      value: Number(item.value ?? 0),
    }));
  }

  private fillMonthSeries(items: CountItem[], length: number): CountItem[] {
    const map = new Map(items.map((item) => [item.label, item.value]));
    return Array.from({ length }).map((_, index) => {
      const date = this.addMonths(new Date(), index - length + 1);
      const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { label, value: map.get(label) ?? 0 };
    });
  }

  private moduleRoute(moduleKey?: string, tabKey?: string) {
    const key = `${moduleKey ?? ''}:${tabKey ?? ''}`;
    const routes: Record<string, string> = {
      'account:accounts': '/client/company/account',
      'basic:shareholders': '/client/company/basic',
      'contract:contracts': '/client/company/contract?tab=contracts&from=todo',
      'contract:invoices': '/client/company/contract?tab=invoices&from=todo',
      'document:documents': '/client/company/document?tab=documents&from=todo',
      'employee:employees': '/client/company/employees',
      'finance:financial': '/client/company/tax?tab=financial&from=todo',
      'finance:taxAudit': '/client/company/tax?tab=taxAudit&from=todo',
      'media:certificates': '/client/company/certificates?tab=certificates&from=todo',
      'media:photos': '/client/company/photos?tab=photos&from=todo',
      'certificate:certificates': '/client/company/certificates?tab=certificates&from=todo',
      'photo:photos': '/client/company/photos?tab=photos&from=todo',
      'property:intellectualProperty': '/client/company/property?tab=intellectualProperty&from=todo',
      'property:productService': '/client/company/property?tab=productService&from=todo',
      'property:researchProject': '/client/company/property?tab=researchProject&from=todo',
      'property:transformation': '/client/company/property?tab=transformation&from=todo',
    };

    return routes[key] ?? '/client/company';
  }

  private profileStatusLabel(status: string) {
    const labels: Record<string, string> = {
      approved: '已通过',
      draft: '待完善',
      need_resubmit: '需补正',
      pending_review: '待审核',
      rejected: '已驳回',
    };
    return labels[status] ?? status;
  }

  private average(values: number[]) {
    if (!values.length) {
      return 0;
    }
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private percent(value: number, total: number) {
    if (!total) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
  }

  private toNumber(value: null | number | string | undefined) {
    if (value === undefined || value === null || value === '') {
      return 0;
    }
    const normalized = typeof value === 'string' ? value.replaceAll(',', '') : value;
    const numberValue = Number(normalized);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private parseStringArray(value: null | string): string[] {
    const parsed = this.parseJson<unknown>(value, []);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter(Boolean);
    }
    return [];
  }

  private parseJson<T>(value: null | string | undefined, fallback: T): T {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private addMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    next.setDate(1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private formatDate(value: Date) {
    return formatDateTimeInBjt(value).slice(0, 10);
  }

  private normalizePriority(value: string): 'high' | 'low' | 'medium' {
    if (value === 'high' || value === 'low') {
      return value;
    }
    return 'medium';
  }
}
