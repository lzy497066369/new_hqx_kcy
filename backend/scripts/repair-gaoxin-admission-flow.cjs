const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function readEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
      .split(/\r?\n/u)
      .filter((line) => line && !line.trim().startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

async function upsertPreset(connection, input) {
  const [rows] = await connection.query(
    'SELECT id FROM biz_declaration_preset WHERE preset_type = ? AND name = ? AND version = ? LIMIT 1',
    [input.presetType, input.name, input.version],
  );
  if (rows.length > 0) {
    await connection.query(
      'UPDATE biz_declaration_preset SET status = ?, description = ?, payload_json = ? WHERE id = ?',
      [input.status ?? 'published', input.description, JSON.stringify(input.payload), rows[0].id],
    );
    return rows[0].id;
  }
  const [result] = await connection.query(
    `INSERT INTO biz_declaration_preset
      (preset_type, name, version, status, description, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [input.presetType, input.name, input.version, input.status ?? 'published', input.description, JSON.stringify(input.payload)],
  );
  return result.insertId;
}

async function ensureDemoEmployees(connection) {
  const [rows] = await connection.query(
    'SELECT id FROM biz_enterprise_employee_record WHERE enterprise_id = 5 AND status = 1',
  );
  const names = ['演示研发人员甲', '演示研发人员乙', '演示研发人员丙'];
  for (let index = rows.length; index < 3; index += 1) {
    await connection.query(
      `INSERT INTO biz_enterprise_employee_record
        (enterprise_id, yg_name, department, position, entry_date, is_active, is_kjyf,
         annual_work_days, labor_contract_file, social_security_file, yg_files, remark, status)
        VALUES (?, ?, '研发部', '研发工程师', '2023-01-01', 1, 1, 260,
          'demo-labor-contract.pdf', 'demo-social-security.pdf', 'demo-employee.pdf',
          '高企评分演示人员资料', 1)`,
      [5, names[index]],
    );
  }
}

async function ensureDemoIp(connection) {
  const [rows] = await connection.query(
    "SELECT id FROM biz_enterprise_property_record WHERE enterprise_id = 5 AND record_type = 'intellectual_property' AND status = 1",
  );
  for (let index = rows.length; index < 15; index += 1) {
    await connection.query(
      `INSERT INTO biz_enterprise_property_record
        (enterprise_id, record_type, ip_code, soft_work_name, soft_work_type,
         soft_work_status, soft_work_num, apply_date, authorize_date, obtain_method,
         inventor, ip_level, right_holder, is_core_ip, advanced_degree,
         support_effect, remark, status)
        VALUES (?, 'intellectual_property', ?, ?, 3, 2, ?, '2023-01-01',
          '2024-01-01', '自主研发', '演示研发团队', 'II类', ?, 0,
          '技术先进', '支撑主要产品服务', '高企评分演示 IP 资料', 1)`,
      [
        5,
        `IP-DEMO-${String(index + 1).padStart(3, '0')}`,
        `软件著作权演示-${index + 1}`,
        `软著DEMO2026${String(index + 1).padStart(3, '0')}`,
        '高企评分演示企业（请勿用于申报）',
      ],
    );
  }
}

async function repair() {
  const env = readEnv();
  const connection = await mysql.createConnection({
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT),
    user: env.DB_USERNAME,
  });
  await connection.beginTransaction();
  try {
    await ensureDemoEmployees(connection);
    await ensureDemoIp(connection);

    const materialRules = [
      { attachmentRequired: 0, isRequired: 1, itemName: '企业基本信息', moduleKey: 'basic', requiredCount: 1, requiredFields: ['name', 'creditCode', 'legalPersonName', 'industry'], requirementDesc: '企业名称、统一社会信用代码、法定代表人和行业信息应完整。', scoreWeight: 1, sortOrder: 10, tabKey: 'info' },
      { attachmentRequired: 1, isRequired: 1, itemName: '科技人员', moduleKey: 'employee', requiredCount: 1, requiredFields: ['ygName'], requirementDesc: '科技人员名单及劳动合同、社保等佐证材料。', scoreWeight: 1, sortOrder: 20, tabKey: 'employees' },
      { attachmentRequired: 1, isRequired: 1, itemName: '知识产权', moduleKey: 'property', requiredCount: 1, requiredFields: ['softWorkName'], requirementDesc: '核心知识产权清单、权属及证书附件。', scoreWeight: 1, sortOrder: 30, tabKey: 'intellectualProperty' },
      { attachmentRequired: 1, isRequired: 1, itemName: '研发项目', moduleKey: 'property', requiredCount: 1, requiredFields: ['kyProjectName'], requirementDesc: '研发项目立项、实施和费用归集资料。', scoreWeight: 1, sortOrder: 40, tabKey: 'researchProject' },
      { attachmentRequired: 1, isRequired: 1, itemName: '成果转化证据', moduleKey: 'property', requiredCount: 1, requiredFields: ['transformationName', 'transformationYear'], requirementDesc: '成果转化年度、方式、关联 IP/RD/PS 及证明材料。', scoreWeight: 1, sortOrder: 50, tabKey: 'transformation' },
      { attachmentRequired: 1, isRequired: 1, itemName: '财务与专项审计资料', moduleKey: 'finance', requiredCount: 1, requiredFields: ['year', 'xxsr', 'yffy', 'highTechIncome'], requirementDesc: '实际经营期财务数据、研发费用和高新收入专项审计或鉴证材料。', scoreWeight: 1, sortOrder: 60, tabKey: 'financial' },
    ];
    const materialPresetId = await upsertPreset(connection, {
      description: '高企申报材料要求，按企业资料台账核验基础信息、人员、知识产权、研发、成果转化和财务审计资料。',
      name: '高企申报材料',
      payload: materialRules,
      presetType: 'material',
      version: 'v1',
    });
    const scoreRules = {
      categories: [
        { key: 'ip', label: '知识产权', maxScore: 30 },
        { key: 'achievement', label: '科技成果转化能力', maxScore: 30 },
        { key: 'rdManagement', label: '研究开发组织管理水平', maxScore: 20 },
        { key: 'growth', label: '企业成长性', maxScore: 20 },
      ],
      model: 'gaoxin-v2-innovation-rules',
      passScore: 71,
    };
    const scorePresetId = await upsertPreset(connection, {
      description: '国家高企创新能力评价模型：四大指标满分 100 分，综合得分达到 71 分及以上为系统建议达标线。',
      name: '高企评分模型',
      payload: scoreRules,
      presetType: 'score',
      version: 'v1',
    });

    const generalQualificationId = await upsertPreset(connection, {
      description: '高企国家层面基本条件预检：成立满一年、科技人员占比、高新技术产品（服务）收入占比、实际经营期财务数据、核心知识产权和适用研发费用比例。知识产权数量、合同发票数量和创新能力得分不作为准入一票否决项。',
      name: '2026 国家高新技术企业通用型基本条件',
      payload: {
        mode: 'all',
        rules: [
          { key: 'enterprise_age_days', operator: 'gte', type: 'metric', value: 365 },
          { key: 'tech_employee_ratio', operator: 'gte', type: 'metric', value: 10 },
          { key: 'latest_high_tech_income_ratio', operator: 'gte', type: 'metric', value: 60 },
          { key: 'gaoxin_financial_period_complete', operator: 'eq', type: 'metric', value: 1 },
          { key: 'core_ip_exists', operator: 'eq', type: 'metric', value: 1 },
          { key: 'three_year_rd_expense_ratio_qualified', operator: 'eq', type: 'metric', value: 1 },
        ],
      },
      presetType: 'qualification',
      version: 'v2',
    });

    const nodeQualificationIds = [];
    for (const [index, payload] of [
      {
        description: '按企业实际经营期补齐财务年度数据，并核对科技人员统计口径。',
        rules: [
          { key: 'gaoxin_financial_period_complete', operator: 'eq', type: 'metric', value: 1 },
          { key: 'personnel_info_exists', operator: 'eq', type: 'metric', value: 1 },
        ],
      },
      {
        description: '核对营业执照和核心知识产权权属；软件著作权是知识产权类型之一，不要求必须存在独立账号。',
        rules: [
          { key: 'business_license_exists', operator: 'eq', type: 'metric', value: 1 },
          { key: 'core_ip_exists', operator: 'eq', type: 'metric', value: 1 },
        ],
      },
      {
        description: '准备人员附件、合同发票、设备场地和培训照片。合同、发票没有全国统一的固定数量门槛，应围绕成果转化和收入证据链准备。',
        rules: [
          { key: 'employee_attachment_coverage_ratio', operator: 'gte', type: 'metric', value: 100 },
        ],
      },
      {
        description: '整理 IP-RD-PS-成果转化证据链；申报账号在属地系统开放后配置，不作为前置资格条件。',
        rules: [
          { key: 'ip_rd_ps_chain_complete', operator: 'eq', type: 'metric', value: 1 },
        ],
      },
      {
        description: '序时账、科目余额表和财务报表附件。',
        rules: [
          { key: 'sequence_ledger_exists', operator: 'eq', type: 'metric', value: 1 },
          { key: 'balance_sheet_exists', operator: 'eq', type: 'metric', value: 1 },
          { key: 'financial_statement_exists', operator: 'eq', type: 'metric', value: 1 },
        ],
      },
    ].entries()) {
      nodeQualificationIds.push(await upsertPreset(connection, {
        description: payload.description,
        name: `2026高企v4节点${index + 1}前置条件`,
        payload: { mode: 'all', rules: payload.rules },
        presetType: 'qualification',
        version: 'v1',
      }));
    }

    const flowTemplate = {
      nodes: [
        { code: '2026_gq_v4_1', name: '企业经营数据统计', role: 'enterprise', type: 'auto', description: '按实际经营期整理财务数据、科技人员和研发费用归集资料。', qualificationPresetIds: [String(nodeQualificationIds[0])], timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_2', name: '核心知识产权梳理', role: 'enterprise', type: 'auto', description: '核对知识产权权属、核心支持作用及与主要产品（服务）的关联。', qualificationPresetIds: [String(nodeQualificationIds[1])], timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_3', name: '申报材料准备', role: 'enterprise', type: 'auto', description: '准备人员、成果转化、合同发票、场地设备、培训等佐证材料。', qualificationPresetIds: [String(nodeQualificationIds[2])], timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_4', name: '申报书与证据链整理', role: 'consultant', type: 'manual', description: '整理高企申报书、IP-RD-PS-成果转化证据链和专家评分依据。', qualificationPresetIds: [String(nodeQualificationIds[3])], timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_5', name: '专项审计及财务附件准备', role: 'consultant', type: 'manual', description: '准备研发费用、高新收入等专项审计或鉴证材料，以及序时账、余额表和财务报表。', qualificationPresetIds: [String(nodeQualificationIds[4])], timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_6', name: '线上申报与材料报送', role: 'enterprise', type: 'manual', description: '以企业注册地科技、财政、税务主管部门当年度通知的申报窗口和要求为准。', timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_7', name: '形式审查、专家评审与现场核查', role: 'consultant', type: 'manual', description: '根据主管部门通知配合补正、专家评审和现场核查。', timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_8', name: '公示与备案', role: 'consultant', type: 'manual', description: '跟进认定机构公示、备案及异议处理。', timeRule: { mode: 'always' } },
        { code: '2026_gq_v4_9', name: '证书获取与后续维护', role: 'enterprise', type: 'end', description: '获取证书后持续维护研发、知识产权、财务和年度发展情况报表。', timeRule: { mode: 'always' } },
      ],
    };
    const flowPresetId = await upsertPreset(connection, {
      description: '高企申报流程 v4：去除不存在的全国统一申报日期和固定材料数量门槛，属地申报窗口以当年度官方通知为准。',
      name: '2026年国家高新技术企业申请',
      payload: flowTemplate,
      presetType: 'flow',
      version: 'v4',
    });

    const qualificationRules = {
      mode: 'all',
      rules: [
        { key: 'enterprise_age_days', operator: 'gte', type: 'metric', value: 365 },
        { key: 'tech_employee_ratio', operator: 'gte', type: 'metric', value: 10 },
        { key: 'latest_high_tech_income_ratio', operator: 'gte', type: 'metric', value: 60 },
        { key: 'gaoxin_financial_period_complete', operator: 'eq', type: 'metric', value: 1 },
        { key: 'core_ip_exists', operator: 'eq', type: 'metric', value: 1 },
        { key: 'three_year_rd_expense_ratio_qualified', operator: 'eq', type: 'metric', value: 1 },
      ],
    };
    const capabilities = { exportPackage: true, gaoxinScore: true, score: true };
    const [qualificationPreset] = await connection.query('SELECT id FROM biz_declaration_preset WHERE id = ?', [generalQualificationId]);
    if (!qualificationPreset.length) throw new Error('准入预设写入失败');
    await connection.query("UPDATE biz_declaration_scheme SET status = 'draft' WHERE project_id = 9 AND region_id IS NULL AND status = 'published'");
    const [existingScheme] = await connection.query("SELECT id FROM biz_declaration_scheme WHERE project_id = 9 AND version = 'v3' LIMIT 1");
    let schemeId;
    const schemeValues = [
      9, null, '国家高新技术企业默认地区申报方案', 'v3', 'published',
      JSON.stringify(qualificationRules),
      JSON.stringify(materialRules),
      JSON.stringify(scoreRules),
      JSON.stringify(flowTemplate),
      JSON.stringify(capabilities),
      generalQualificationId, materialPresetId, scorePresetId, flowPresetId,
    ];
    if (existingScheme.length > 0) {
      schemeId = existingScheme[0].id;
      await connection.query(
        `UPDATE biz_declaration_scheme SET status = 'published', qualification_rules_json = ?,
          material_rules_json = ?, score_rules_json = ?, flow_template_json = ?,
          capabilities_json = ?, qualification_preset_id = ?, material_preset_id = ?,
          score_preset_id = ?, flow_preset_id = ? WHERE id = ?`,
        [...schemeValues.slice(5), schemeId],
      );
    } else {
      const [schemeResult] = await connection.query(
        `INSERT INTO biz_declaration_scheme (
          project_id, region_id, scheme_name, version, status, qualification_rules_json,
          material_rules_json, score_rules_json, flow_template_json, capabilities_json,
          qualification_preset_id, material_preset_id, score_preset_id, flow_preset_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        schemeValues,
      );
      schemeId = schemeResult.insertId;
    }

    const schemeSnapshot = {
      capabilities,
      flowTemplate,
      id: String(schemeId),
      materialRules,
      qualification: { missing: [], status: 'eligible' },
      qualificationRules,
      schemeName: '国家高新技术企业默认地区申报方案',
      scoreRules,
      version: 'v3',
    };
    await connection.query(
      `UPDATE biz_client_declaration SET scheme_id = ?, scheme_version = 'v3',
        snapshot_json = ?, current_node_name = '企业经营数据统计', progress = 0,
        status = 'preparing', missing_material_count = 0 WHERE id = 3 AND enterprise_id = 5`,
      [schemeId, JSON.stringify({ scheme: schemeSnapshot })],
    );

    await connection.commit();
    console.log(JSON.stringify({ generalQualificationId, flowPresetId, nodeQualificationIds, schemeId, declarationId: 3, enterpriseId: 5 }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

repair().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
