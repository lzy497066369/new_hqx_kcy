/** Presentation only: submission eligibility remains enforced by the backend. */
export type JourneyStageKey =
  | 'profile'
  | 'data'
  | 'policy'
  | 'declaration'
  | 'materials'
  | 'export'
  | 'review'
  | 'results';
export type JourneyStatus =
  | 'complete'
  | 'current'
  | 'attention'
  | 'upcoming'
  | 'available'
  | 'unknown';
export interface JourneyTarget {
  stage: JourneyStageKey;
  declarationId?: string;
  moduleKey?: string;
  tabKey?: string;
}
export interface JourneyGap {
  title: string;
  description: string;
  target: JourneyTarget;
}
export interface JourneyProfileItem {
  isCompleted: boolean;
  itemName: string;
  missingFields: string[];
  moduleKey: string;
  tabKey: string;
}
export interface JourneyDeclaration {
  id: string;
  projectName: string;
  status: string;
  deadline: Date | null | string;
  updatedAt: Date | string;
  rejectedReason: null | string;
  currentNodeName: null | string;
}
export interface JourneyOverview {
  enterpriseId: string;
  baseMissing: string[];
  profileItems: JourneyProfileItem[];
  completedModules: number;
  totalModules: number;
  candidateCount: number;
  declarations: JourneyDeclaration[];
}
export interface JourneyDetail {
  qualification?: null | { missing: string[]; status: string };
  materialCheck: null | {
    checkStatus: string;
    readinessScore: number;
    items: Array<{
      checkStatus?: string;
      itemName?: string;
      missingFields?: string[];
      moduleKey?: string;
      tabKey?: string;
      suggestion?: null | string;
    }>;
  };
}
export interface JourneyStage {
  key: JourneyStageKey;
  title: string;
  status: JourneyStatus;
  summary: string;
  description: string;
  actionLabel: string;
  target: JourneyTarget;
  gaps: JourneyGap[];
}
export interface ServiceJourney {
  stages: JourneyStage[];
  current: JourneyStage;
  declaration?: JourneyDeclaration;
  declarations: JourneyDeclaration[];
  returnedCount: number;
  profileProgress: string;
  deadlineText?: string;
}

export const journeyStatusLabels: Record<JourneyStatus, string> = {
  complete: '已完成',
  current: '当前阶段',
  attention: '需处理',
  upcoming: '待推进',
  available: '可查看',
  unknown: '待核验',
};
export function declarationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: '草稿',
    preparing: '材料准备',
    rejected: '退回补正',
    reviewing: '内部审核中',
    submitted: '已提交内部流程',
    approved: '内部审核通过',
    completed: '服务已完成',
    cancelled: '已取消',
  };
  return labels[status] ?? '状态待确认';
}
const historical = new Set(['approved', 'completed', 'cancelled']);
export function needsJourneyDetail(status: string) {
  return !historical.has(status);
}
function dateValue(value: Date | null | string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : Number.POSITIVE_INFINITY;
}
export function sortJourneyDeclarations(declarations: JourneyDeclaration[]) {
  const ranks: Record<string, number> = {
    rejected: 0,
    draft: 1,
    preparing: 1,
    reviewing: 2,
    submitted: 2,
    approved: 3,
    completed: 4,
    cancelled: 5,
  };
  return [...declarations].sort((a, b) => {
    const rank = (ranks[a.status] ?? 1) - (ranks[b.status] ?? 1);
    if (rank) return rank;
    const deadline = dateValue(a.deadline) - dateValue(b.deadline);
    if (Number.isFinite(deadline) && deadline) return deadline;
    if (dateValue(a.deadline) !== dateValue(b.deadline))
      return dateValue(a.deadline) < dateValue(b.deadline) ? -1 : 1;
    const updatedA = dateValue(a.updatedAt);
    const updatedB = dateValue(b.updatedAt);
    if (
      Number.isFinite(updatedA) &&
      Number.isFinite(updatedB) &&
      updatedA !== updatedB
    )
      return updatedB - updatedA;
    return a.id.localeCompare(b.id);
  });
}
export function getBaseProfileMissing(profile: {
  name?: null | string;
  creditCode?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
}) {
  return [
    [profile.name, '企业名称'],
    [profile.creditCode, '统一社会信用代码'],
    [profile.contactName, '联系人'],
    [profile.contactPhone, '联系电话'],
  ]
    .filter(([value]) => !value?.trim())
    .map(([, label]) => label!);
}

export function buildServiceJourney(
  overview: JourneyOverview,
  selectedId?: string,
  detail?: JourneyDetail,
  now = new Date(),
): ServiceJourney {
  const declarations = sortJourneyDeclarations(overview.declarations);
  const declaration =
    declarations.find((item) => item.id === selectedId) ?? declarations[0];
  const dataComplete =
    overview.totalModules > 0 &&
    overview.completedModules >= overview.totalModules;
  const target = (stage: JourneyStageKey): JourneyTarget => ({
    stage,
    declarationId: declaration?.id,
  });
  const stages: JourneyStage[] = [
    {
      key: 'profile',
      title: '企业建档',
      status: overview.baseMissing.length ? 'attention' : 'complete',
      summary: overview.baseMissing.length
        ? `${overview.baseMissing.length} 项基础信息待补齐`
        : '基础档案已建立',
      description:
        '先确认企业身份和联系人。基础信息会用于政策筛选和申报资料复用。',
      actionLabel: '维护企业档案',
      target: { stage: 'profile' },
      gaps: overview.baseMissing.map((title) => ({
        title,
        description: '基础信息未填写',
        target: { stage: 'profile' },
      })),
    },
    {
      key: 'data',
      title: '企业资料补齐',
      status: dataComplete
        ? 'complete'
        : overview.totalModules > 0
          ? 'attention'
          : 'unknown',
      summary:
        overview.totalModules > 0
          ? `${overview.completedModules}/${overview.totalModules} 个资料域已完成`
          : '暂无可用资料统计',
      description:
        '维护人员、财税、研发和知识产权等可复用资料。完整度用于提醒，不是所有政策的统一准入门槛。',
      actionLabel: '补齐企业资料',
      target: { stage: 'data' },
      gaps: overview.profileItems
        .filter((item) => !item.isCompleted)
        .map((item) => ({
          title: item.itemName,
          description: item.missingFields.length
            ? item.missingFields.join('、')
            : '资料或附件尚不完整',
          target: {
            stage: 'data',
            moduleKey: item.moduleKey,
            tabKey: item.tabKey,
          },
        })),
    },
    {
      key: 'declaration',
      title: '创建申报',
      status: declaration ? 'complete' : 'upcoming',
      summary: declaration
        ? '已建立本条申报记录'
        : `${overview.candidateCount} 个候选项目可筛选并创建申报草稿`,
      description:
        '在此筛选政策项目并创建申报。一项申报对应一条独立记录；已有草稿请继续办理，其他项目可单独创建。',
      actionLabel: declaration ? '查看本条申报' : '选择项目并创建申报',
      target: target('declaration'),
      gaps: [],
    },
    {
      key: 'materials',
      title: '材料准备',
      status: declaration ? 'unknown' : 'upcoming',
      summary: declaration
        ? '材料核验结果待确认'
        : '创建申报后核对项目材料清单',
      description:
        '依据项目要求核对材料和附件、提交内部审核，并按审核意见补正。企业资料可复用；退回原因和审核节点均在申报详情查看。',
      actionLabel: '核对材料与审核进度',
      target: target('materials'),
      gaps: [],
    },
    {
      key: 'export',
      title: '材料导出',
      status: declaration ? 'available' : 'upcoming',
      summary: declaration ? '可查看申报材料导出包' : '创建申报后生成所需材料',
      description: '在申报详情中检查导出条件并下载材料包。',
      actionLabel: '打开材料导出',
      target: target('export'),
      gaps: [],
    },
    {
      key: 'results',
      title: '申报结果归档',
      status: 'upcoming',
      summary: '流程结束后核对结果与留存资料',
      description:
        '核对办理结果并留存归档。内部审核通过不等于政府认定通过；系统未提供独立归档确认，不能自动标记为已归档。',
      actionLabel: '查看历史记录与结果',
      target: target('results'),
      gaps: [],
    },
  ];
  const declarationStage = stages[2]!;
  const material = stages[3]!;
  const exportStage = stages[4]!;
  const results = stages[5]!;
  if (detail?.materialCheck) {
    const check = detail.materialCheck;
    // An empty checklist is not proof that material preparation is complete.
    const passed =
      check.items.length > 0 &&
      check.checkStatus === 'passed' &&
      check.items.every((item) => item.checkStatus === 'passed');
    material.status = passed ? 'complete' : 'attention';
    material.summary = check.items.length
      ? `材料核验 ${Math.round(check.readinessScore)} 分 · ${passed ? '清单已通过' : '仍需核对'}`
      : '未配置有效材料清单，请在详情中确认';
    material.gaps = check.items
      .filter((item) => item.checkStatus !== 'passed')
      .map((item) => ({
        title: item.itemName || '待核验材料',
        description:
          [item.missingFields?.join('、'), item.suggestion]
            .filter(Boolean)
            .join('；') || '资料、附件或关联记录待补齐',
        target: {
          ...target('materials'),
          moduleKey: item.moduleKey,
          tabKey: item.tabKey,
        },
      }));
  }
  if (detail?.qualification?.status === 'ineligible') {
    material.status = 'attention';
    material.gaps.unshift(
      ...detail.qualification.missing.map((title) => ({
        title,
        description: '当前方案资格条件未满足',
        target: target('materials'),
      })),
    );
    material.actionLabel = '核对资格与补齐材料';
  } else if (material.status === 'complete')
    material.actionLabel = '核对并提交内部审核';
  let currentKey: JourneyStageKey;
  if (declaration) {
    if (declaration.status === 'rejected') {
      currentKey = 'materials';
      material.status = 'attention';
      material.summary = '申报已退回，请优先补正';
      material.actionLabel = '查看退回原因并补正';
      material.gaps = [
        {
          title: '审核退回',
          description: declaration.rejectedReason || '请在申报详情查看审核意见',
          target: target('materials'),
        },
      ];
    } else if (['draft', 'preparing'].includes(declaration.status)) {
      currentKey = 'materials';
      if (material.status !== 'attention') material.status = 'current';
    } else if (['reviewing', 'submitted'].includes(declaration.status)) {
      currentKey = 'materials';
      material.status = 'current';
      material.summary = declaration.currentNodeName
        ? `审核节点：${declaration.currentNodeName}`
        : '已进入内部审核，请关注审核进度';
    } else if (historical.has(declaration.status)) {
      currentKey = 'results';
      results.status = 'current';
      material.status =
        declaration.status === 'cancelled' ? 'upcoming' : 'complete';
      material.summary =
        declaration.status === 'cancelled'
          ? '本条申报已取消'
          : declarationStatusLabel(declaration.status);
      exportStage.status = declaration.status === 'cancelled' ? 'upcoming' : 'available';
      results.summary =
        declaration.status === 'cancelled'
          ? '已取消，保留办理记录'
          : `${declarationStatusLabel(declaration.status)}，请核对结果留存`;
    } else {
      currentKey = 'declaration';
      declarationStage.status = 'unknown';
      declarationStage.summary = '申报状态无法识别，请查看详情确认';
    }
  } else {
    currentKey = overview.baseMissing.length
      ? 'profile'
      : !dataComplete
        ? 'data'
        : 'declaration';
    const current = stages.find((item) => item.key === currentKey)!;
    if (current.status !== 'attention' && current.status !== 'unknown')
      current.status = 'current';
  }
  let deadlineText: string | undefined;
  if (
    declaration &&
    !historical.has(declaration.status) &&
    Number.isFinite(dateValue(declaration.deadline))
  ) {
    const dateOnly =
      typeof declaration.deadline === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(declaration.deadline);
    const deadline = new Date(
      dateOnly ? `${declaration.deadline}T00:00:00` : declaration.deadline!,
    );
    // Date-only deadlines remain valid through the end of their local calendar day.
    if (dateOnly) deadline.setHours(23, 59, 59, 999);
    const days = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
    deadlineText = `${deadline.toLocaleDateString('zh-CN')} 截止 · ${deadline.getTime() < now.getTime() ? '已过截止日期，请确认申报窗口' : deadline.toDateString() === now.toDateString() ? '今天截止' : `约剩 ${days} 天`}`;
  }
  return {
    stages,
    current: stages.find((item) => item.key === currentKey)!,
    declaration,
    declarations,
    returnedCount: declarations.filter((item) => item.status === 'rejected')
      .length,
    profileProgress: overview.totalModules
      ? `${overview.completedModules}/${overview.totalModules} 个资料域`
      : '资料统计待确认',
    deadlineText,
  };
}
