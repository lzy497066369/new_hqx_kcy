#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const PROPERTY_AI_SCENES = [
  'ip_recognition',
  'transformation_generation',
  'research_generation',
  'product_service_generation',
];
const SAMPLE_MARKER = 'client-property-ai-verification-sample';
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const DATABASE_SCHEMA_AUDIT_ITEMS = [
  {
    columns: [
      'id',
      'scene',
      'biz_type',
      'biz_id',
      'status',
      'input_snapshot',
      'created_by',
      'finished_at',
    ],
    key: 'ai_tasks',
    label: 'AI 任务表',
    table: 'ai_tasks',
  },
  {
    columns: [
      'id',
      'enterprise_id',
      'task_id',
      'draft_type',
      'status',
      'source_ids',
      'draft_payload',
      'approved_record_id',
      'reviewed_by',
      'reviewed_at',
    ],
    key: 'ai_drafts',
    label: 'AI 草稿表',
    table: 'ai_drafts',
  },
  {
    columns: [
      'id',
      'enterprise_id',
      'record_type',
      'soft_work_name',
      'soft_work_num',
      'transformation_name',
      'ky_project_name',
      'ps_name',
      'related_ip_ids',
      'related_rd_ids',
      'related_ps_ids',
      'related_transformation_ids',
      'status',
    ],
    key: 'property_records',
    label: '企业研发与知识产权正式记录表',
    table: 'biz_enterprise_property_record',
  },
  {
    columns: [
      'id',
      'enterprise_id',
      'template_id',
      'material_type',
      'file_name',
      'file_path',
      'status',
    ],
    key: 'enterprise_materials',
    label: '企业附件材料表',
    table: 'biz_enterprise_material',
  },
  {
    columns: ['id', 'name', 'status'],
    key: 'enterprises',
    label: '企业基础表',
    table: 'biz_enterprise',
  },
];

const IMPLEMENTATION_AUDIT_ITEMS = [
  {
    area: '文档',
    file: 'doc/22-研发与知识产权AI批量生成规范与开发顺序.md',
    key: 'doc_22',
    label: 'doc/22 规范文档',
    patterns: [
      '知识产权 PDF 批量识别',
      '成果转化批量生成',
      'RD 研发项目立项报告生成',
      'PS 高新产品批量生成',
      '最终验收标准',
    ],
  },
  {
    area: '数据结构',
    file: 'backend/sql/client-property-ai-drafts-p1.sql',
    key: 'sql_ai_drafts',
    label: 'AI 草稿 SQL',
    patterns: ['CREATE TABLE IF NOT EXISTS `ai_drafts`', '`draft_payload`'],
  },
  {
    area: '数据结构',
    file: 'backend/sql/client-property-rd-ip-ps-p2-p5.sql',
    key: 'sql_property_relations',
    label: 'IP/RD/PS 关系字段 SQL',
    patterns: ['related_ip_ids', 'related_rd_ids', 'related_transformation_ids'],
  },
  {
    area: '数据结构',
    file: 'backend/src/infrastructure/database/entities/ai-draft.entity.ts',
    key: 'entity_ai_draft',
    label: 'AI 草稿实体',
    patterns: ["@Entity('ai_drafts')", 'draftPayload', 'approvedRecordId'],
  },
  {
    area: '数据结构',
    file: 'backend/src/infrastructure/database/entities/enterprise-property-record.entity.ts',
    key: 'entity_property_record',
    label: '企业资料正式记录实体',
    patterns: [
      'recordType',
      'relatedIpIds',
      'relatedRdIds',
      'relatedTransformationIds',
    ],
  },
  {
    area: '后端接口',
    file: 'backend/src/modules/client/client.controller.ts',
    key: 'backend_ip',
    label: 'IP PDF 上传识别接口',
    patterns: [
      "FilesInterceptor('files', 20",
      "Post('enterprise/property/ip-recognition/uploads')",
      "Post('enterprise/property/ip-recognition/tasks')",
      "Get('enterprise/property/ip-recognition/drafts')",
      "Post('enterprise/property/ip-recognition/approve')",
      "Post('enterprise/property/ip-recognition/retry')",
    ],
  },
  {
    area: '后端接口',
    file: 'backend/src/modules/client/client.controller.ts',
    key: 'backend_transformation',
    label: '成果转化批量生成接口',
    patterns: [
      "Get('enterprise/property/transformation/generation/sources')",
      "Post('enterprise/property/transformation/generation/tasks')",
      "Get('enterprise/property/transformation/generation/drafts')",
      "Post('enterprise/property/transformation/generation/approve')",
    ],
  },
  {
    area: '后端接口',
    file: 'backend/src/modules/client/client.controller.ts',
    key: 'backend_rd',
    label: 'RD 立项报告生成接口',
    patterns: [
      "Get('enterprise/property/research/generation/sources')",
      "Post('enterprise/property/research/generation/tasks')",
      "Post('enterprise/property/research/generation/auto-match/preview')",
      "Get('enterprise/property/research/generation/drafts')",
      "Post('enterprise/property/research/generation/approve')",
    ],
  },
  {
    area: '后端接口',
    file: 'backend/src/modules/client/client.controller.ts',
    key: 'backend_ps',
    label: 'PS 批量生成接口',
    patterns: [
      "Get('enterprise/property/product-service/generation/sources')",
      "Post('enterprise/property/product-service/generation/tasks')",
      "Get('enterprise/property/product-service/generation/drafts')",
      "Post('enterprise/property/product-service/generation/drafts/:id/duplicate')",
      "Post('enterprise/property/product-service/generation/approve')",
    ],
  },
  {
    area: '后端接口',
    file: 'backend/src/modules/client/client.controller.ts',
    key: 'backend_evidence_preview',
    label: '证据链和附件授权预览接口',
    patterns: [
      "Get('enterprise/materials/:id/preview')",
      "Get('enterprise/property/evidence-summary')",
      "Get('enterprise/property/ai-tasks')",
      "Post('enterprise/property/evidence-relations/repair')",
    ],
  },
  {
    area: '后端逻辑',
    file: 'backend/src/modules/client/client.service.ts',
    key: 'service_approve_relations',
    label: '草稿审核入库和关系保存逻辑',
    patterns: [
      'approveClientIpRecognitionDrafts',
      'approveClientTransformationGenerationDrafts',
      'approveClientResearchGenerationDrafts',
      'approveClientProductServiceGenerationDrafts',
      'getClientPropertyEvidenceSummary',
      'previewClientEnterpriseMaterial',
    ],
  },
  {
    area: '后端逻辑',
    file: 'backend/src/modules/client/client.service.ts',
    key: 'service_rd_auto_match',
    label: 'RD 软著优先自动匹配和下证时间约束',
    patterns: [
      'resolveResearchAutoMatchPlan',
      'resolveResearchAutoMatchYears',
      'buildResearchAutoMatchGroups',
      'software-copyright-first',
      'softWorkType === 3',
      'activeRdDraftRows',
      'resolveAutoMatchedResearchPeriod',
      'endDate.getTime() >= earliestIpTime',
    ],
  },
  {
    area: '后端逻辑',
    file: 'backend/src/modules/client/client.service.ts',
    key: 'service_failure_recovery',
    label: '失败、退回、删除和重试闭环',
    patterns: [
      'markClientPropertyAiTaskFailed',
      'rejectClientPropertyGenerationDrafts',
      'deleteClientPropertyGenerationDraft',
      'retryClientIpRecognitionDrafts',
      "task.status = 'failed'",
      'failed.push',
    ],
  },
  {
    area: '后端安全',
    file: 'backend/src/modules/client/client.service.ts',
    key: 'service_material_preview_security',
    label: '企业附件授权预览安全',
    patterns: [
      'previewClientEnterpriseMaterial',
      'requireCurrentEnterpriseId',
      'enterpriseId',
      'resolveStoredUploadAbsolutePath',
      'createReadStream',
      'Content-Disposition',
      'inline;',
    ],
  },
  {
    area: '验收脚本',
    file: 'backend/scripts/verify-client-property-ai.cjs',
    key: 'script_seed_cleanup',
    label: '脱敏样例写入与清理',
    patterns: [
      'SAMPLE_MARKER',
      'seedSampleDataset',
      'cleanupSampleDataset',
      '--seed-sample',
      '--write',
      '--cleanup-sample',
    ],
  },
  {
    area: '前端 API',
    file: 'vue-admin/apps/web-client/src/api/client/enterprise-property.ts',
    key: 'frontend_api',
    label: '客户端企业资料 AI API',
    patterns: [
      'uploadClientIpRecognitionPdfsApi',
      'createClientTransformationGenerationTaskApi',
      'createClientResearchGenerationTaskApi',
      'previewClientResearchAutoMatchApi',
      'createClientProductServiceGenerationTaskApi',
      'getClientPropertyEvidenceSummaryApi',
      'getClientPropertyAiTasksApi',
    ],
  },
  {
    area: '前端安全',
    file: 'vue-admin/apps/web-client/src/views/client/enterprise-profile/property/components/IpPdfImportModal.vue',
    key: 'frontend_pdf_preview_auth',
    label: 'PDF 授权预览链接',
    patterns: [
      'buildProtectedPdfHref',
      'access_token',
      'soft_work_file',
      'target="_blank"',
      'noopener',
    ],
  },
  {
    area: '前端页面',
    file: 'vue-admin/apps/web-client/src/views/client/enterprise-profile/property/index.vue',
    key: 'frontend_property_page',
    label: '研发与知识产权页面接入',
    patterns: [
      'IpPdfImportModal',
      'TransformationBatchGenerateModal',
      'ResearchProjectAiGenerateModal',
      'ProductServiceBatchGenerateModal',
      'AiTaskAuditModal',
      'evidenceChecklist',
    ],
  },
  {
    area: '前端组件',
    file: 'vue-admin/apps/web-client/src/views/client/enterprise-profile/property/components/IpPdfImportModal.vue',
    key: 'frontend_ip_modal',
    label: 'IP PDF 拖拽上传审核组件',
    patterns: [
      'uploadClientIpRecognitionPdfsApi',
      'approveClientIpRecognitionDraftsApi',
      'retryClientIpRecognitionDraftsApi',
      'accept',
      '.pdf',
    ],
  },
  {
    area: '前端组件',
    file: 'vue-admin/apps/web-client/src/views/client/enterprise-profile/property/components/TransformationBatchGenerateModal.vue',
    key: 'frontend_transformation_modal',
    label: '成果转化批量生成组件',
    patterns: [
      'getClientTransformationGenerationSourcesApi',
      'createClientTransformationGenerationTaskApi',
      'approveClientTransformationGenerationDraftsApi',
    ],
  },
  {
    area: '前端组件',
    file: 'vue-admin/apps/web-client/src/views/client/enterprise-profile/property/components/ResearchProjectAiGenerateModal.vue',
    key: 'frontend_rd_modal',
    label: 'RD 立项报告生成组件',
    patterns: [
      'getClientResearchGenerationSourcesApi',
      'createClientResearchGenerationTaskApi',
      'approveClientResearchGenerationDraftsApi',
      'initDate',
      'endDate',
    ],
  },
  {
    area: '前端组件',
    file: 'vue-admin/apps/web-client/src/views/client/enterprise-profile/property/components/ProductServiceBatchGenerateModal.vue',
    key: 'frontend_ps_modal',
    label: 'PS 批量生成组件',
    patterns: [
      'getClientProductServiceGenerationSourcesApi',
      'createClientProductServiceGenerationTaskApi',
      'duplicateClientProductServiceGenerationDraftApi',
      'approveClientProductServiceGenerationDraftsApi',
    ],
  },
];

function getArg(name) {
  const prefix = `${name}=`;
  const matched = process.argv.find((item) => item.startsWith(prefix));
  return matched ? matched.slice(prefix.length) : null;
}

function readWorkspaceFile(relativePath) {
  const absolutePath = path.resolve(WORKSPACE_ROOT, relativePath);
  if (!absolutePath.startsWith(WORKSPACE_ROOT + path.sep)) {
    throw new Error(`非法文件路径：${relativePath}`);
  }
  return fs.existsSync(absolutePath)
    ? fs.readFileSync(absolutePath, 'utf8')
    : null;
}

function auditImplementation() {
  const results = IMPLEMENTATION_AUDIT_ITEMS.map((item) => {
    const content = readWorkspaceFile(item.file);
    const missingPatterns = content
      ? item.patterns.filter((pattern) => !content.includes(pattern))
      : item.patterns;

    return {
      area: item.area,
      detail:
        missingPatterns.length === 0
          ? `${item.patterns.length} 个检查点均已覆盖`
          : `缺少：${missingPatterns.join('、')}`,
      file: item.file,
      key: item.key,
      label: item.label,
      status: content && missingPatterns.length === 0 ? 'passed' : 'missing',
    };
  });

  const passed = results.every((item) => item.status === 'passed');
  console.log('研发与知识产权 AI 实现覆盖审计');
  console.log(`总体结果：${passed ? '通过' : '未通过'}`);
  console.table(
    results.map((item) => ({
      area: item.area,
      key: item.key,
      status: item.status,
      检查项: item.label,
      详情: item.detail,
    })),
  );
  if (!passed) {
    console.log('缺口文件：');
    results
      .filter((item) => item.status !== 'passed')
      .forEach((item) => console.log(`- ${item.file}: ${item.detail}`));
  }
  return { passed, results };
}

async function auditDatabaseSchema() {
  if (!process.env.DB_DATABASE) {
    throw new Error('缺少 DB_DATABASE，无法审计数据库结构');
  }

  const connection = await createDatabaseConnection();
  try {
    const tables = DATABASE_SCHEMA_AUDIT_ITEMS.map((item) => item.table);
    const [rows] = await connection.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name IN (${tables.map(() => '?').join(', ')})`,
      [process.env.DB_DATABASE, ...tables],
    );
    const columnsByTable = new Map();
    rows.forEach((row) => {
      const table = String(row.table_name ?? '');
      const column = String(row.column_name ?? '');
      columnsByTable.set(table, [
        ...(columnsByTable.get(table) ?? []),
        column,
      ]);
    });

    const results = DATABASE_SCHEMA_AUDIT_ITEMS.map((item) => {
      const columns = new Set(columnsByTable.get(item.table) ?? []);
      const missingColumns = item.columns.filter((column) => !columns.has(column));
      const tableExists = columns.size > 0;
      return {
        detail: !tableExists
          ? `缺少表：${item.table}`
          : missingColumns.length === 0
            ? `${item.columns.length} 个关键字段均已存在`
            : `缺少字段：${missingColumns.join('、')}`,
        key: item.key,
        label: item.label,
        status: tableExists && missingColumns.length === 0 ? 'passed' : 'missing',
        table: item.table,
      };
    });
    const passed = results.every((item) => item.status === 'passed');

    console.log('研发与知识产权 AI 数据库结构审计');
    console.log(`总体结果：${passed ? '通过' : '未通过'}`);
    console.table(
      results.map((item) => ({
        key: item.key,
        status: item.status,
        数据表: item.table,
        检查项: item.label,
        详情: item.detail,
      })),
    );
    if (!passed) {
      console.log('数据库结构缺口：');
      results
        .filter((item) => item.status !== 'passed')
        .forEach((item) => console.log(`- ${item.table}: ${item.detail}`));
    }

    return { passed, results };
  } finally {
    await connection.end();
  }
}

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/u).forEach((line) => {
    const text = line.trim();
    if (!text || text.startsWith('#')) {
      return;
    }
    const equalsIndex = text.indexOf('=');
    if (equalsIndex <= 0) {
      return;
    }
    const key = text.slice(0, equalsIndex).trim();
    const rawValue = text.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }
    process.env[key] = rawValue.replace(/^['"]|['"]$/gu, '');
  });
}

function parseRelationIds(value) {
  return String(value ?? '')
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesRelationId(value, id) {
  return parseRelationIds(value).includes(String(id));
}

function hasRelationValue(value) {
  return parseRelationIds(value).length > 0;
}

function unique(values) {
  return [...new Set(values.map((item) => String(item)).filter(Boolean))];
}

function buildEvidenceChain(rd, ipRows, psRows, transformationRows) {
  const rdId = String(rd.id ?? '');
  const ipIds = unique([
    ...parseRelationIds(rd.related_ip_ids),
    ...ipRows
      .filter((ip) => includesRelationId(ip.related_rd_ids, rdId))
      .map((ip) => ip.id),
  ]);
  const psIds = unique([
    ...parseRelationIds(rd.related_ps_ids),
    ...psRows
      .filter((ps) => {
        const psIpIds = parseRelationIds(ps.related_ip_ids);
        return (
          includesRelationId(ps.related_rd_ids, rdId) ||
          psIpIds.some((id) => ipIds.includes(id))
        );
      })
      .map((ps) => ps.id),
  ]);
  const transformationIds = unique([
    ...parseRelationIds(rd.related_transformation_ids),
    ...transformationRows
      .filter((item) => {
        const transformationIpIds = parseRelationIds(item.related_ip_ids);
        return (
          includesRelationId(item.related_rd_ids, rdId) ||
          transformationIpIds.some((id) => ipIds.includes(id))
        );
      })
      .map((item) => item.id),
  ]);

  return {
    gaps: [
      ...(ipIds.length > 0 ? [] : ['未关联 IP']),
      ...(psIds.length > 0 ? [] : ['未关联 PS']),
      ...(transformationIds.length > 0 ? [] : ['未关联成果']),
    ],
    id: rdId,
    ipIds,
    name: rd.ky_project_name || rd.ky_project_num || '未命名RD项目',
    psIds,
    transformationIds,
  };
}

function hasPsRdRelation(ps, rdRows) {
  return rdRows.some((rd) => {
    const rdId = String(rd.id ?? '');
    const psId = String(ps.id ?? '');
    return (
      includesRelationId(ps.related_rd_ids, rdId) ||
      includesRelationId(rd.related_ps_ids, psId)
    );
  });
}

function hasPsIpRelation(ps, ipRows) {
  return ipRows.some((ip) => {
    const ipId = String(ip.id ?? '');
    const psId = String(ps.id ?? '');
    return (
      includesRelationId(ps.related_ip_ids, ipId) ||
      includesRelationId(ip.related_ps_ids, psId)
    );
  });
}

function hasTransformationIpRelation(item, ipRows) {
  return ipRows.some((ip) => {
    const ipId = String(ip.id ?? '');
    const transformationId = String(item.id ?? '');
    return (
      includesRelationId(item.related_ip_ids, ipId) ||
      includesRelationId(ip.related_transformation_ids, transformationId)
    );
  });
}

function isIpUsedInChain(ip, rdRows, psRows, transformationRows) {
  const ipId = String(ip.id ?? '');
  return [
    ...rdRows.map((rd) => rd.related_ip_ids),
    ...psRows.map((ps) => ps.related_ip_ids),
    ...transformationRows.map((item) => item.related_ip_ids),
  ].some((idsText) => includesRelationId(idsText, ipId));
}

function buildGaps(chains, ipRows, rdRows, psRows, transformationRows) {
  return [
    ...chains.flatMap((chain) =>
      chain.gaps.map((gap) => `${chain.name} ${gap}`),
    ),
    ...psRows.flatMap((ps) =>
      [
        hasPsRdRelation(ps, rdRows)
          ? ''
          : `${ps.ps_name || '未命名 PS'} 未关联 RD`,
        hasPsIpRelation(ps, ipRows)
          ? ''
          : `${ps.ps_name || '未命名 PS'} 未关联 IP`,
        hasRelationValue(ps.related_transformation_ids)
          ? ''
          : `${ps.ps_name || '未命名 PS'} 未关联成果转化`,
        hasRelationValue(ps.related_contract_ids) ||
        hasRelationValue(ps.related_invoice_ids)
          ? ''
          : `${ps.ps_name || '未命名 PS'} 未关联合同/发票证明`,
      ].filter(Boolean),
    ),
    ...transformationRows
      .filter((item) => !hasTransformationIpRelation(item, ipRows))
      .map((item) => `${item.transformation_name || '未命名成果'} 未关联 IP`),
    ...transformationRows
      .filter(
        (item) =>
          !hasRelationValue(item.related_contract_ids) &&
          !hasRelationValue(item.related_invoice_ids),
      )
      .map((item) => `${item.transformation_name || '未命名成果'} 未关联合同/发票证明`),
    ...ipRows
      .filter((ip) => !isIpUsedInChain(ip, rdRows, psRows, transformationRows))
      .map((ip) => `${ip.soft_work_name || '未命名 IP'} 尚未进入 RD/PS/成果链路`),
  ];
}

function buildChecklist(input) {
  const aiPassedCount = PROPERTY_AI_SCENES.filter((scene) =>
    input.succeededAiScenes.has(scene),
  ).length;

  return [
    {
      detail:
        input.ipRows.length > 0
          ? `${input.ipRows.length} 条知识产权已入库，${input.ipUsedInChain} 条进入证据链`
          : '尚未入库知识产权',
      key: 'ip',
      label: '知识产权入库',
      status:
        input.ipRows.length === 0
          ? 'missing'
          : input.ipUsedInChain < input.ipRows.length
            ? 'warning'
            : 'passed',
    },
    {
      detail:
        input.transformationRows.length > 0
          ? `${input.transformationWithIp}/${input.transformationRows.length} 条成果已关联 IP`
          : '尚未入库成果转化',
      key: 'transformation',
      label: '成果转化关联',
      status:
        input.transformationRows.length === 0
          ? 'missing'
          : input.transformationWithIp < input.transformationRows.length
            ? 'warning'
            : 'passed',
    },
    {
      detail:
        input.rdRows.length > 0
          ? `${input.rdWithIp}/${input.rdRows.length} 条 RD 已关联 IP`
          : '尚未入库 RD 研发项目',
      key: 'rd',
      label: 'RD 立项链路',
      status:
        input.rdRows.length === 0
          ? 'missing'
          : input.rdWithIp < input.rdRows.length
            ? 'warning'
            : 'passed',
    },
    {
      detail:
        input.psRows.length > 0
          ? `${input.psWithRd}/${input.psRows.length} 条 PS 关联 RD，${input.psWithIp}/${input.psRows.length} 条 PS 关联 IP`
          : '尚未入库 PS 高新产品/服务',
      key: 'ps',
      label: 'PS 聚合链路',
      status:
        input.psRows.length === 0
          ? 'missing'
          : input.psWithRd < input.psRows.length ||
              input.psWithIp < input.psRows.length
            ? 'warning'
            : 'passed',
    },
    {
      detail:
        input.rdRows.length > 0
          ? `${input.completeRdChains}/${input.rdRows.length} 条 RD 链路完整，${input.gaps.length} 个缺口`
          : '需要先生成或录入 RD 后再验证完整链路',
      key: 'evidence_chain',
      label: '证据链完整度',
      status:
        input.rdRows.length === 0
          ? 'missing'
          : input.completeRdChains === input.rdRows.length &&
              input.gaps.length === 0
            ? 'passed'
            : 'warning',
    },
    {
      detail: `已完成 ${aiPassedCount}/${PROPERTY_AI_SCENES.length} 类 AI 任务成功记录`,
      key: 'ai_audit',
      label: 'AI 审计记录',
      status:
        aiPassedCount === 0
          ? 'missing'
          : aiPassedCount < PROPERTY_AI_SCENES.length
            ? 'warning'
            : 'passed',
    },
  ];
}

function verifyDataset(dataset) {
  const { ipRows, rdRows, psRows, transformationRows, aiTasks } = dataset;
  const chains = rdRows.map((rd) =>
    buildEvidenceChain(rd, ipRows, psRows, transformationRows),
  );
  const gaps = buildGaps(chains, ipRows, rdRows, psRows, transformationRows);
  const rdWithIp = chains.filter((chain) => chain.ipIds.length > 0).length;
  const psWithRd = psRows.filter((ps) => hasPsRdRelation(ps, rdRows)).length;
  const psWithIp = psRows.filter((ps) => hasPsIpRelation(ps, ipRows)).length;
  const transformationWithIp = transformationRows.filter((item) =>
    hasTransformationIpRelation(item, ipRows),
  ).length;
  const ipUsedInChain = ipRows.filter((ip) =>
    isIpUsedInChain(ip, rdRows, psRows, transformationRows),
  ).length;
  const completeRdChains = chains.filter((chain) => chain.gaps.length === 0).length;
  const succeededAiScenes = new Set(
    aiTasks.filter((task) => task.status === 'success').map((task) => task.scene),
  );
  const checklist = buildChecklist({
    completeRdChains,
    gaps,
    ipRows,
    ipUsedInChain,
    psRows,
    psWithIp,
    psWithRd,
    rdRows,
    rdWithIp,
    succeededAiScenes,
    transformationRows,
    transformationWithIp,
  });

  return {
    checklist,
    gaps,
    passed: checklist.every((item) => item.status === 'passed'),
    stats: {
      completeRdChains,
      gapTotal: gaps.length,
      intellectualPropertyTotal: ipRows.length,
      ipUsedInChain,
      psTotal: psRows.length,
      psWithIp,
      psWithRd,
      rdTotal: rdRows.length,
      rdWithIp,
      transformationTotal: transformationRows.length,
      transformationWithIp,
    },
  };
}

function sampleDataset() {
  return {
    aiTasks: PROPERTY_AI_SCENES.map((scene, index) => ({
      id: String(index + 1),
      scene,
      status: 'success',
    })),
    ipRows: [
      {
        id: '1',
        related_rd_ids: '10',
        related_ps_ids: '20',
        related_transformation_ids: '30',
        soft_work_name: '智能数据分析软件',
      },
    ],
    psRows: [
      {
        id: '20',
        ps_name: '企业智能数据分析服务平台',
        related_contract_ids: '40',
        related_ip_ids: '1',
        related_rd_ids: '10',
        related_transformation_ids: '30',
      },
    ],
    rdRows: [
      {
        id: '10',
        ky_project_name: '智能数据分析平台研发项目',
        related_ip_ids: '1',
        related_ps_ids: '20',
        related_transformation_ids: '30',
      },
    ],
    transformationRows: [
      {
        id: '30',
        related_contract_ids: '40',
        related_ip_ids: '1',
        related_ps_ids: '20',
        related_rd_ids: '10',
        transformation_name: '智能数据分析平台成果转化',
      },
    ],
  };
}

async function createDatabaseConnection() {
  return mysql.createConnection({
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST || '127.0.0.1',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
  });
}

async function loadDatasetFromDatabase(enterpriseId) {
  const connection = await createDatabaseConnection();

  try {
    const [propertyRows] = await connection.query(
      `SELECT *
       FROM biz_enterprise_property_record
       WHERE enterprise_id = ? AND status = 1`,
      [enterpriseId],
    );
    const [aiTasks] = await connection.query(
      `SELECT id, scene, status
       FROM ai_tasks
       WHERE biz_id = ? AND biz_type = 'enterprise' AND scene IN (?, ?, ?, ?)`,
      [enterpriseId, ...PROPERTY_AI_SCENES],
    );

    return {
      aiTasks,
      ipRows: propertyRows.filter((row) => row.record_type === 'intellectual_property'),
      psRows: propertyRows.filter((row) => row.record_type === 'product_service'),
      rdRows: propertyRows.filter((row) => row.record_type === 'research_project'),
      transformationRows: propertyRows.filter((row) => row.record_type === 'transformation'),
    };
  } finally {
    await connection.end();
  }
}

async function listEnterpriseCandidates() {
  const connection = await createDatabaseConnection();
  try {
    const [rows] = await connection.query(
      `SELECT *
       FROM (
         SELECT
           e.id,
           e.name,
           COUNT(DISTINCT CASE WHEN p.record_type = 'intellectual_property' THEN p.id ELSE NULL END) AS ip_total,
           COUNT(DISTINCT CASE WHEN p.record_type = 'transformation' THEN p.id ELSE NULL END) AS transformation_total,
           COUNT(DISTINCT CASE WHEN p.record_type = 'research_project' THEN p.id ELSE NULL END) AS rd_total,
           COUNT(DISTINCT CASE WHEN p.record_type = 'product_service' THEN p.id ELSE NULL END) AS ps_total,
           COUNT(DISTINCT CASE
             WHEN t.status = 'success' AND t.scene IN (?, ?, ?, ?) THEN t.scene
             ELSE NULL
           END) AS ai_success_scene_total
         FROM biz_enterprise e
         LEFT JOIN biz_enterprise_property_record p
           ON p.enterprise_id = e.id AND p.status = 1
         LEFT JOIN ai_tasks t
           ON t.biz_id = CAST(e.id AS CHAR) AND t.biz_type = 'enterprise'
         WHERE e.status = 1
         GROUP BY e.id, e.name
       ) candidates
       ORDER BY
         (ip_total + transformation_total + rd_total + ps_total + ai_success_scene_total) DESC,
         id DESC
       LIMIT 20`,
      PROPERTY_AI_SCENES,
    );
    return rows;
  } finally {
    await connection.end();
  }
}

function printSeedSamplePreview(enterpriseId, enterpriseName, write = false) {
  console.log(
    `${write ? '即将' : '将'}为企业 ${enterpriseId}（${enterpriseName}）写入脱敏验收样例：`,
  );
  console.table([
    {
      类型: '知识产权',
      编号: `SAMPLE-IP-${enterpriseId}`,
      名称: '验收样例-智能数据分析软件',
    },
    {
      类型: '成果转化',
      编号: `SAMPLE-CG-${enterpriseId}`,
      名称: '验收样例-智能数据分析平台成果转化',
    },
    {
      类型: 'RD',
      编号: `SAMPLE-RD-${enterpriseId}`,
      名称: '验收样例-智能数据分析平台研发项目',
    },
    {
      类型: 'PS',
      编号: `SAMPLE-PS-${enterpriseId}`,
      名称: '验收样例-企业智能数据分析服务平台',
    },
    {
      类型: 'AI任务',
      编号: '4类场景',
      名称: PROPERTY_AI_SCENES.join('、'),
    },
  ]);
  if (!write) {
    console.log('当前仅为预览，不会写入数据库；确认写入请追加 --write。');
  }
}

async function seedSampleDataset(enterpriseId, options = { write: false }) {
  const connection = await createDatabaseConnection();
  try {
    const [enterpriseRows] = await connection.query(
      `SELECT id, name FROM biz_enterprise WHERE id = ? AND status = 1`,
      [enterpriseId],
    );
    if (enterpriseRows.length === 0) {
      throw new Error(`企业不存在或已停用：${enterpriseId}`);
    }
    printSeedSamplePreview(enterpriseId, enterpriseRows[0].name, options.write);
    if (!options.write) {
      return false;
    }

    const [existingRows] = await connection.query(
      `SELECT id, record_type
       FROM biz_enterprise_property_record
       WHERE enterprise_id = ? AND remark = ? AND status = 1`,
      [enterpriseId, SAMPLE_MARKER],
    );
    if (existingRows.length >= 4) {
      console.log(`企业 ${enterpriseId} 已存在验收样例数据，跳过写入。`);
      return true;
    }

    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM biz_enterprise_property_record
       WHERE enterprise_id = ? AND remark = ?`,
      [enterpriseId, SAMPLE_MARKER],
    );

    const [ipResult] = await connection.query(
      `INSERT INTO biz_enterprise_property_record
       (enterprise_id, record_type, soft_work_name, soft_work_type, soft_work_status,
        soft_work_num, apply_date, authorize_date, obtain_method, ip_level,
        right_holder, is_core_ip, support_effect, remark, status)
       VALUES (?, 'intellectual_property', ?, 4, 2, ?, '2025-01-10', '2025-03-18',
        '自主研发', 'II类', ?, 1, ?, ?, 1)`,
      [
        enterpriseId,
        '验收样例-智能数据分析软件',
        `SAMPLE-IP-${enterpriseId}`,
        enterpriseRows[0].name,
        '用于支撑 RD、成果转化和 PS 的脱敏验收样例。',
        SAMPLE_MARKER,
      ],
    );
    const ipId = String(ipResult.insertId);

    const [transformationResult] = await connection.query(
      `INSERT INTO biz_enterprise_property_record
       (enterprise_id, record_type, transformation_code, transformation_name,
        transformation_year, transformation_method, application_scene, related_ip_ids,
        related_contract_ids, remark, status)
       VALUES (?, 'transformation', ?, ?, '2025', '自行实施', ?, ?, 'sample-contract', ?, 1)`,
      [
        enterpriseId,
        `SAMPLE-CG-${enterpriseId}`,
        '验收样例-智能数据分析平台成果转化',
        '将智能数据分析软件应用于企业数据采集、指标分析和风险识别。',
        ipId,
        SAMPLE_MARKER,
      ],
    );
    const transformationId = String(transformationResult.insertId);

    const [rdResult] = await connection.query(
      `INSERT INTO biz_enterprise_property_record
       (enterprise_id, record_type, ky_project_name, ky_project_num, ky_project_status,
        init_date, end_date, ky_project_leader, project_type, ky_project_des,
        core_technology, innovation_points, stage_result, related_ip_ids,
        related_transformation_ids, remark, status)
       VALUES (?, 'research_project', ?, ?, 3, '2025-01-01', '2025-12-31',
        '验收负责人', '数字化技术', ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        enterpriseId,
        '验收样例-智能数据分析平台研发项目',
        `SAMPLE-RD-${enterpriseId}`,
        '围绕企业数据采集、指标分析、风险识别开展研发。',
        '数据采集、指标建模、风险识别算法。',
        '形成面向企业服务场景的数据分析模型。',
        '形成软件、成果转化和高新产品服务。',
        ipId,
        transformationId,
        SAMPLE_MARKER,
      ],
    );
    const rdId = String(rdResult.insertId);

    const [psResult] = await connection.query(
      `INSERT INTO biz_enterprise_property_record
       (enterprise_id, record_type, ps_code, ps_name, tech_field, tech_source,
        tech_description, tech_index, competitive_advantage, related_ip_ids,
        related_rd_ids, related_transformation_ids, related_contract_ids, remark, status)
       VALUES (?, 'product_service', ?, ?, '数字化技术', '自主研发',
        ?, ?, ?, ?, ?, ?, 'sample-contract', ?, 1)`,
      [
        enterpriseId,
        `SAMPLE-PS-${enterpriseId}`,
        '验收样例-企业智能数据分析服务平台',
        '汇总 RD 与知识产权形成企业数据分析服务能力。',
        '支持数据采集、指标计算、风险识别和结果输出。',
        '可复用知识产权和研发成果，支撑高新产品服务申报。',
        ipId,
        rdId,
        transformationId,
        SAMPLE_MARKER,
      ],
    );
    const psId = String(psResult.insertId);

    await connection.query(
      `UPDATE biz_enterprise_property_record
       SET related_rd_ids = ?, related_ps_ids = ?, related_transformation_ids = ?
       WHERE id = ?`,
      [rdId, psId, transformationId, ipId],
    );
    await connection.query(
      `UPDATE biz_enterprise_property_record
       SET related_rd_ids = ?, related_ps_ids = ?
       WHERE id = ?`,
      [rdId, psId, transformationId],
    );
    await connection.query(
      `UPDATE biz_enterprise_property_record
       SET related_ps_ids = ?
       WHERE id = ?`,
      [psId, rdId],
    );

    await connection.query(
      `DELETE FROM ai_tasks
       WHERE biz_id = ? AND biz_type = 'enterprise' AND input_snapshot = ?`,
      [String(enterpriseId), SAMPLE_MARKER],
    );
    for (const scene of PROPERTY_AI_SCENES) {
      await connection.query(
        `INSERT INTO ai_tasks
         (scene, biz_type, biz_id, status, input_snapshot, created_by, finished_at)
         VALUES (?, 'enterprise', ?, 'success', ?, '0', NOW())`,
        [scene, String(enterpriseId), SAMPLE_MARKER],
      );
    }

    await connection.commit();
    console.log(
      `已为企业 ${enterpriseId} 写入脱敏验收样例：IP ${ipId} / 成果 ${transformationId} / RD ${rdId} / PS ${psId}`,
    );
    return true;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.end();
  }
}

async function cleanupSampleDataset(enterpriseId) {
  const connection = await createDatabaseConnection();
  try {
    await connection.beginTransaction();
    const [propertyResult] = await connection.query(
      `DELETE FROM biz_enterprise_property_record
       WHERE enterprise_id = ? AND remark = ?`,
      [enterpriseId, SAMPLE_MARKER],
    );
    const [taskResult] = await connection.query(
      `DELETE FROM ai_tasks
       WHERE biz_id = ? AND biz_type = 'enterprise' AND input_snapshot = ?`,
      [String(enterpriseId), SAMPLE_MARKER],
    );
    await connection.commit();
    console.log(
      `已清理企业 ${enterpriseId} 的脱敏验收样例：资料 ${propertyResult.affectedRows ?? 0} 条，AI 任务 ${taskResult.affectedRows ?? 0} 条。`,
    );
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.end();
  }
}

function printResult(result, sourceLabel) {
  console.log(`研发与知识产权 AI 链路验收：${sourceLabel}`);
  console.log(`总体结果：${result.passed ? '通过' : '未通过'}`);
  console.table(
    result.checklist.map((item) => ({
      key: item.key,
      status: item.status,
      验收项: item.label,
      详情: item.detail,
    })),
  );
  if (result.gaps.length > 0) {
    console.log('缺口：');
    result.gaps.forEach((gap) => console.log(`- ${gap}`));
  }
}

async function main() {
  loadEnvFile();
  const auditOnly = process.argv.includes('--audit-implementation');
  const auditSchemaOnly = process.argv.includes('--audit-schema');
  const useSample = process.argv.includes('--sample');
  const listEnterprises = process.argv.includes('--list-enterprises');
  const writeSeedSample = process.argv.includes('--write');
  const seedSampleEnterpriseId = getArg('--seed-sample');
  const cleanupSampleEnterpriseId = getArg('--cleanup-sample');
  const enterpriseId = getArg('--enterprise-id') || process.env.ENTERPRISE_ID;

  if (auditOnly) {
    const result = auditImplementation();
    if (!result.passed) {
      process.exit(1);
    }
    return;
  }

  if (auditSchemaOnly) {
    const result = await auditDatabaseSchema();
    if (!result.passed) {
      process.exit(1);
    }
    return;
  }

  if (listEnterprises) {
    const candidates = await listEnterpriseCandidates();
    console.log('可验收企业候选（最多 20 条）：');
    console.table(
      candidates.map((item) => ({
        id: String(item.id),
        企业名称: item.name,
        IP: Number(item.ip_total ?? 0),
        成果: Number(item.transformation_total ?? 0),
        RD: Number(item.rd_total ?? 0),
        PS: Number(item.ps_total ?? 0),
        AI成功场景: Number(item.ai_success_scene_total ?? 0),
      })),
    );
    return;
  }

  if (seedSampleEnterpriseId) {
    const didWrite = await seedSampleDataset(seedSampleEnterpriseId, {
      write: writeSeedSample,
    });
    if (!didWrite) {
      return;
    }
    const dataset = await loadDatasetFromDatabase(seedSampleEnterpriseId);
    const result = verifyDataset(dataset);
    printResult(result, `企业 ${seedSampleEnterpriseId}`);
    if (!result.passed) {
      process.exit(1);
    }
    return;
  }

  if (cleanupSampleEnterpriseId) {
    await cleanupSampleDataset(cleanupSampleEnterpriseId);
    return;
  }

  if (!useSample && !enterpriseId) {
    console.error(
      '请传入 --enterprise-id=<id> 检查真实企业数据，使用 --audit-implementation 审计实现覆盖，使用 --audit-schema 只读审计数据库结构，使用 --list-enterprises 查看候选企业，使用 --seed-sample=<id> 预览脱敏验收样例，使用 --seed-sample=<id> --write 写入样例，使用 --cleanup-sample=<id> 清理样例，或使用 --sample 验证脚本逻辑。',
    );
    process.exit(2);
  }

  const dataset = useSample
    ? sampleDataset()
    : await loadDatasetFromDatabase(enterpriseId);
  const result = verifyDataset(dataset);
  printResult(result, useSample ? '内置样例' : `企业 ${enterpriseId}`);

  if (!result.passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
