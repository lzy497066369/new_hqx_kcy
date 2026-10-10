// Migrated from declare-assistant. Keep the client/server catalog identical.
export interface MaterialField {
  key: string;
  label: string;
  type?: string;
  options?: { label: string; value: string }[];
}
export const ATTACHMENT_SECTIONS = [
  {
    no: '1',
    key: 'cover',
    title: '申请书封皮',
    kind: 'pdf',
    hint: '上传签字盖章后的申请书封皮 PDF。',
  },
  {
    no: '2',
    key: 'application_pdf',
    title: '高新技术企业认定申请书',
    kind: 'pdf',
    hint: '上传签字盖章后的申请书 PDF。',
  },
  {
    no: '3',
    key: 'business_license',
    title: '企业营业执照',
    kind: 'pdf',
    hint: '上传营业执照扫描件 PDF。',
  },
  {
    no: '4',
    key: 'ip',
    title: 'IP(知识产权)相关材料',
    kind: 'pdf',
    hint: '上传专利、软著等知识产权证明 PDF，可多份。',
  },
  {
    no: '5',
    key: 'staff_statement',
    title: '企业人员相关资料',
    kind: 'placeholder',
    hint: '上传企业人员情况说明、劳动合同、社保清单等 PDF。',
  },
  {
    no: '6',
    key: 'rd_project_table',
    title: 'RD(研究开发活动)相关资料',
    kind: 'placeholder',
    hint: '上传研发项目立项报告、结题报告等 PDF。',
  },
  {
    no: '7',
    key: 'rd_expense_audit',
    title: '近三年研发费用专项审计报告',
    kind: 'pdf',
    hint: '按年度上传申报前三年的研发费用专项审计报告 PDF。',
  },
  {
    no: '8',
    key: 'hitech_products',
    title: 'PS(高新产品(服务))相关资料',
    kind: 'placeholder',
    hint: '维护产品汇总表、PS 情况说明及每个产品对应的证明附件。',
  },
  {
    no: '9',
    key: 'hitech_income_audit',
    title: '近一年高新产品(服务)收入专项审计报告',
    kind: 'pdf',
    hint: '上传近一年高新技术产品（服务）收入专项审计报告 PDF。',
  },
  {
    no: '10',
    key: 'achievement_transform',
    title: '科技成果转化说明材料',
    kind: 'achievement',
    hint: '维护成果转化明细，沿用申请书导出数据。',
  },
  {
    no: '11',
    key: 'system_docs',
    title: '研究开发组织管理水平证明材料',
    kind: 'system',
    hint: '维护组织管理制度框架，并跳转生成制度正文。',
  },
  {
    no: '12',
    key: 'annual_audit',
    title: '财务审计报表',
    kind: 'pdf',
    hint: '上传近三年年度审计报告 PDF，可多份。',
  },
  {
    no: '13',
    key: 'tax_settlement',
    title: '企业所得税纳税申报表其他说明材料',
    kind: 'pdf',
    hint: '上传企业所得税汇算清缴文件 PDF，可多份。',
  },
  {
    no: '14',
    key: 'commitment',
    title: '国家网告知承诺书',
    kind: 'pdf',
    hint: '上传国家科技管理信息系统公共服务平台签署的告知承诺书 PDF。',
  },
];
export const ACHIEVEMENT_EVIDENCE_UPLOAD_TYPES = [
  {
    key: 'patent_cert',
    title: '专利证书',
    hint: '上传该成果对应的专利证书 PDF。',
  },
  {
    key: 'sales_contract',
    title: '销售合同',
    hint: '上传该成果转化相关销售合同 PDF。',
  },
  {
    key: 'sales_invoice',
    title: '销售发票',
    hint: '上传该成果转化相关销售发票 PDF。',
  },
  {
    key: 'product_photo',
    title: '产品照片',
    hint: '上传产品照片整理成的 PDF。',
  },
];
export const ACHIEVEMENT_EVIDENCE_EDIT_TYPES = [
  {
    key: 'test_report',
    title: '性能测试报告',
    ai_field: 'achievement_test_report',
  },
  {
    key: 'user_report',
    title: '用户使用报告',
    ai_field: 'achievement_user_report',
  },
];
export const HITECH_PRODUCT_EVIDENCE_TYPES = [
  {
    key: 'patent_cert',
    title: '专利证书',
    hint: '上传该产品对应的专利证书 PDF。',
  },
  {
    key: 'test_report',
    title: '性能测试报告',
    hint: '上传本公司对本技术进行性能测试形成的测试报告 PDF。',
  },
  {
    key: 'sales_contract',
    title: '销售合同',
    hint: '上传该产品对应的销售合同 PDF。',
  },
  {
    key: 'sales_invoice',
    title: '销售发票',
    hint: '上传该产品对应的销售发票 PDF。',
  },
  {
    key: 'product_photo',
    title: '产品照片',
    hint: '上传产品照片整理成的 PDF。',
  },
  {
    key: 'user_report',
    title: '用户使用报告',
    hint: '上传客户对本公司产品和服务评价形成的用户使用报告 PDF。',
  },
];
export const SYSTEM_DOC_TYPES = [
  {
    key: 'rd_project',
    title: '科研项目立项管理制度',
    short: '项目立项',
    guide:
      '重点写清研发项目来源、立项申请、可行性论证、预算审核、负责人审批、项目编号、过程记录和验收归档。',
  },
  {
    key: 'rd_accounting',
    title: '研发投入核算体系制度',
    short: '投入核算',
    guide:
      '重点写清研发投入归集口径、财务部门与研发部门职责、预算控制、费用审批、项目维度核算和年度汇总机制。',
  },
  {
    key: 'rd_auxiliary_ledger',
    title: '研发费用辅助账制度',
    short: '辅助账',
    guide:
      '重点写清按研发项目建立辅助账、费用科目、凭证附件、月度归集、年度结转、审计核查和留存要求。',
  },
  {
    key: 'rd_center',
    title: '研发中心管理制度',
    short: '研发中心',
    guide:
      '重点写清研发机构设置、科研条件、设备场地、岗位职责、会议机制、项目组织和研发档案管理。',
  },
  {
    key: 'industry_university_research',
    title: '产学研合作管理制度',
    short: '产学研',
    guide:
      '重点写清合作对象筛选、合作形式、合同签署、知识产权归属、成果交付、保密要求和合作项目验收。',
  },
  {
    key: 'achievement_transform',
    title: '科技成果转化组织实施制度',
    short: '成果转化',
    guide:
      '重点写清成果筛选、评审、试制、产品应用、转化效果评价、销售或应用证明材料归档。',
  },
  {
    key: 'achievement_reward',
    title: '科技成果转化激励奖励制度',
    short: '转化奖励',
    guide:
      '重点写清成果转化奖励对象、奖励条件、评价指标、审批流程、发放方式和争议处理。',
  },
  {
    key: 'innovation_platform',
    title: '开放式创新创业平台管理制度',
    short: '创新平台',
    guide:
      '重点写清平台定位、开放资源、内部孵化、外部协同、项目入驻、资源使用和成果输出管理。',
  },
  {
    key: 'staff_training',
    title: '科技人员培养进修与职工技能培训制度',
    short: '人员培训',
    guide:
      '重点写清年度培训计划、科技人员进修、岗位技能培训、培训记录、效果评价和经费支持。',
  },
  {
    key: 'talent_performance',
    title: '优秀人才引进与人才绩效评价奖励制度',
    short: '人才绩效',
    guide:
      '重点写清人才引进条件、招聘流程、绩效评价维度、研发贡献评价、晋升奖励和持续改进机制。',
  },
];
export const SYSTEM_BASE_FIELDS = [
  ['company_name', '企业名称'],
  ['company_english_name', '企业英文名称'],
  ['responsible_person', '企业负责人'],
  ['rd_director', '研发负责人'],
  ['finance_director', '财务负责人'],
  ['rd_center_name', '研发机构名称'],
  ['rd_department', '研发/技术部门'],
  ['applicable_year', '适用年度'],
  ['effective_date', '生效日期'],
  ['tech_field', '技术领域'],
  ['main_business', '主营业务'],
  ['main_products', '主要产品或服务'],
  ['main_rd_projects', '主要研发项目'],
  ['evidence_project_code', '研发项目编号'],
  ['evidence_project_name', '佐证材料项目名称'],
  ['evidence_project_source', '项目来源'],
  ['evidence_project_period', '项目周期'],
  ['evidence_budget_amount', '研发预算/经费'],
  ['evidence_project_goal', '研发目标'],
  ['evidence_project_content', '核心研发内容'],
  ['evidence_project_innovation', '关键技术或创新点'],
  ['evidence_acceptance_standard', '验收或考核指标'],
  ['evidence_expected_result', '预期或阶段成果'],
  ['evidence_record_date', '记录/审批日期'],
  ['evidence_participants', '参会/培训/参与人员'],
  ['rd_staff_names', '研发人员名单（评分板块）'],
  ['evidence_archive_no', '归档编号'],
  ['evidence_archive_location', '归档位置'],
  ['generation_notes', '制度正文和佐证文件补充信息'],
  ['staff_total', '职工总数'],
  ['tech_staff', '科技人员数'],
];
export const SYSTEM_EVIDENCE_FILE_TEMPLATES = {
  rd_project: [
    [
      '研发项目立项申请表',
      '集中记录项目来源、目标内容、周期预算、预期成果、验收指标和审批意见。',
    ],
  ],
  rd_accounting: [
    [
      '研发投入归集审批表',
      '按研发项目归集主要费用、归集依据、预算金额和财务复核意见。',
    ],
    [
      '研发投入月度汇总表',
      '按月汇总各研发项目主要投入情况，支撑年度研发费用统计。',
    ],
    ['研发投入年度复核表', '年度末复核研发投入口径、辅助账和申报数据一致性。'],
  ],
  rd_auxiliary_ledger: [
    [
      '研发费用辅助账建账表',
      '明确辅助账项目、费用科目、建账日期、责任人和财务复核要求。',
    ],
    [
      '研发费用辅助账月度登记表',
      '逐月登记项目费用、凭证编号、金额、归集说明和复核状态。',
    ],
    ['研发费用年度结转确认表', '确认年度辅助账结转、差异调整和审计留痕。'],
  ],
  rd_center: [
    [
      '研发中心组织架构及岗位职责表',
      '归档研发机构设置、岗位分工、人员配置和职责边界。',
    ],
    ['研发设备场地台账', '记录研发设备、场地、软件工具、使用部门和维护情况。'],
    [
      '研发中心例会纪要',
      '记录研发中心项目协调、问题处理、资源安排和会议决议。',
    ],
    [
      '研发档案移交登记表',
      '记录制度、项目、知识产权、试验记录等研发档案移交和保管信息。',
    ],
  ],
  industry_university_research: [
    [
      '产学研合作立项评审表',
      '评审合作单位资质、合作目标、投入资源、成果交付和风险控制。',
    ],
    [
      '产学研合作协议要点登记表',
      '登记合同名称、合作内容、知识产权归属、保密条款和验收安排。',
    ],
    [
      '产学研合作过程记录表',
      '记录沟通会议、技术交流、阶段交付、问题闭环和责任人。',
    ],
    [
      '产学研成果验收确认表',
      '确认合作成果、验收意见、交付资料和后续转化安排。',
    ],
  ],
  achievement_transform: [
    [
      '科技成果转化项目登记表',
      '登记成果来源、转化对象、应用场景、责任部门和转化计划。',
    ],
    [
      '成果转化评审记录',
      '记录技术成熟度、应用价值、试制条件、风险和评审结论。',
    ],
    [
      '试制试用及应用证明表',
      '记录样品、试用、客户或内部应用、反馈和改进情况。',
    ],
    ['成果转化效果评价表', '汇总转化收入、应用效果、知识产权支撑和归档材料。'],
  ],
  achievement_reward: [
    [
      '成果转化奖励申请表',
      '记录奖励事项、成果贡献、申请人、奖励依据和审批意见。',
    ],
    ['成果贡献评价表', '评价人员在研发、转化、市场应用、知识产权中的贡献。'],
    ['奖励审批发放登记表', '记录奖励标准、审批链、发放方式、凭证和签收情况。'],
    ['成果奖励争议处理记录', '记录异议事项、调查过程、处理意见和归档结论。'],
  ],
  innovation_platform: [
    [
      '创新创业平台项目入驻申请表',
      '记录内部孵化或外部协同项目的入驻条件、资源需求和审批意见。',
    ],
    [
      '平台资源开放使用登记表',
      '登记设备、场地、数据、专家等资源开放使用和归还情况。',
    ],
    ['创新平台协同活动记录', '记录技术交流、辅导、路演、测试验证等平台活动。'],
    ['平台项目成果输出确认表', '确认平台项目阶段成果、转化去向和归档附件。'],
  ],
  staff_training: [
    [
      '科技人员年度培训计划表',
      '制定培训主题、对象、时间、预算、组织部门和预期效果。',
    ],
    ['科技人员培养进修审批表', '审批外部进修、专业培训、资格认证和费用支持。'],
    [
      '职工技能培训签到及记录表',
      '记录培训时间、地点、讲师、参训人员、课程内容和签到。',
    ],
    ['培训效果评价表', '评价培训结果、岗位应用、改进建议和后续培养安排。'],
  ],
  talent_performance: [
    [
      '优秀人才引进审批表',
      '记录人才需求、岗位条件、面试评价、薪酬建议和审批意见。',
    ],
    [
      '研发人才绩效评价表',
      '评价研发任务、项目贡献、成果转化、知识产权和协作表现。',
    ],
    ['人才奖励晋升审批表', '记录奖励晋升依据、评价结果、审批链和执行情况。'],
    ['人才持续培养跟踪表', '跟踪培养目标、阶段表现、培训安排和改进措施。'],
  ],
};
// Keep these definitions identical on the client and server so forms and exports agree.
export const HR_OVERVIEW_ROWS = [
  { label: '总数（人）', employeeKey: 'hr_total', techKey: 'hr_tech' },
  {
    label: '其中：在职人员',
    employeeKey: 'hr_fulltime',
    techKey: 'hr_tech_fulltime',
  },
  {
    label: '兼职人员',
    employeeKey: 'hr_parttime',
    techKey: 'hr_tech_parttime',
  },
  { label: '临时聘用人员', employeeKey: 'hr_temp', techKey: 'hr_tech_temp' },
  { label: '外籍人员', employeeKey: 'hr_foreign', techKey: 'hr_tech_foreign' },
  {
    label: '留学归国人员',
    employeeKey: 'hr_returnee',
    techKey: 'hr_tech_returnee',
  },
  {
    label: '人才计划人员',
    employeeKey: 'hr_talent_plan',
    techKey: 'hr_tech_talent_plan',
  },
];
export const HR_STRUCTURE_GROUPS = [
  {
    label: '学历',
    fields: [
      { key: 'edu_phd', label: '博士' },
      { key: 'edu_master', label: '硕士' },
      { key: 'edu_bachelor', label: '本科' },
      { key: 'edu_diploma', label: '大专及以下' },
    ],
  },
  {
    label: '职称',
    fields: [
      { key: 'title_senior', label: '高级职称' },
      { key: 'title_mid', label: '中级职称' },
      { key: 'title_junior', label: '初级职称' },
      { key: 'title_tech', label: '高级技工' },
    ],
  },
  {
    label: '年龄',
    fields: [
      { key: 'age_30', label: '30岁及以下' },
      { key: 'age_31_40', label: '31–40岁' },
      { key: 'age_41_50', label: '41–50岁' },
      { key: 'age_51', label: '51岁及以上' },
    ],
  },
];

export const BOOK_FORM_SECTIONS: {
  key: string;
  title: string;
  fields: MaterialField[];
}[] = [
  {
    key: 'profile',
    title: '企业简介',
    fields: [
      {
        key: 'company_intro',
        label: '企业简介',
        type: 'textarea',
      },
      {
        key: 'business_scope',
        label: '主营业务',
        type: 'textarea',
      },
    ],
  },
  {
    key: 'main',
    title: '一、主要情况表',
    fields: [
      {
        key: 'company_name',
        label: '企业名称',
        type: 'text',
      },
      {
        key: 'tech_field',
        label: '技术领域',
        type: 'text',
      },
      {
        key: 'ip_class1_count',
        label: 'Ⅰ类知识产权数量',
        type: 'number',
      },
      {
        key: 'ip_class2_count',
        label: 'Ⅱ类知识产权数量',
        type: 'number',
      },
      {
        key: 'staff_total',
        label: '职工总数',
        type: 'number',
      },
      {
        key: 'tech_staff',
        label: '科技人员数',
        type: 'number',
      },
      {
        key: 'year1_net_assets',
        label: '净资产（万元）',
        type: 'number',
      },
      {
        key: 'year1_sales',
        label: '销售收入（万元）',
        type: 'number',
      },
      {
        key: 'year1_profit',
        label: '利润总额（万元）',
        type: 'number',
      },
      {
        key: 'year2_net_assets',
        label: '净资产（万元）',
        type: 'number',
      },
      {
        key: 'year2_sales',
        label: '销售收入（万元）',
        type: 'number',
      },
      {
        key: 'year2_profit',
        label: '利润总额（万元）',
        type: 'number',
      },
      {
        key: 'year3_net_assets',
        label: '净资产（万元）',
        type: 'number',
      },
      {
        key: 'year3_sales',
        label: '销售收入（万元）',
        type: 'number',
      },
      {
        key: 'year3_profit',
        label: '利润总额（万元）',
        type: 'number',
      },
      {
        key: 'rd_total_3y',
        label: '近三年研发费用总额（万元）',
        type: 'number',
      },
      {
        key: 'rd_domestic',
        label: '境内研发费用（万元）',
        type: 'number',
      },
      {
        key: 'rd_basic',
        label: '基础研究费用（万元）',
        type: 'number',
      },
      {
        key: 'revenue_1y',
        label: '近一年总收入（万元）',
        type: 'number',
      },
      {
        key: 'hitech_revenue',
        label: '近一年高新收入（万元）',
        type: 'number',
      },
      {
        key: 'accident',
        label: '重大安全、质量事故或严重环境违法行为',
        type: 'select',
        options: [
          {
            label: '请选择',
            value: '',
          },
          {
            label: '是',
            value: 'yes',
          },
          {
            label: '否',
            value: 'no',
          },
        ],
      },
    ],
  },
  {
    key: 'ip',
    title: '二、知识产权汇总表',
    fields: [
      {
        key: 'ip_invention',
        label: '发明专利',
        type: 'number',
      },
      {
        key: 'ip_defense',
        label: '其中：国防专利',
        type: 'number',
      },
      {
        key: 'ip_plant',
        label: '植物新品种',
        type: 'number',
      },
      {
        key: 'ip_crop',
        label: '国家级农作物品种',
        type: 'number',
      },
      {
        key: 'ip_pharma',
        label: '国家新药',
        type: 'number',
      },
      {
        key: 'ip_tcm',
        label: '国家一级中药保护品种',
        type: 'number',
      },
      {
        key: 'ip_ic',
        label: '集成电路布图设计专有权',
        type: 'number',
      },
      {
        key: 'ip_utility',
        label: '实用新型',
        type: 'number',
      },
      {
        key: 'ip_design',
        label: '外观设计',
        type: 'number',
      },
      {
        key: 'ip_copyright',
        label: '软件著作权',
        type: 'number',
      },
    ],
  },
  {
    key: 'hr',
    title: '三、人力资源情况表',
    fields: [
      ...HR_OVERVIEW_ROWS.flatMap((row) => [
        {
          key: row.employeeKey,
          label:
            row.employeeKey === 'hr_total'
              ? '企业职工总数'
              : `企业职工：${row.label}`,
          type: 'number',
        },
        {
          key: row.techKey,
          label:
            row.techKey === 'hr_tech' ? '科技人员' : `科技人员：${row.label}`,
          type: 'number',
        },
      ]),
      ...HR_STRUCTURE_GROUPS.flatMap((group) =>
        group.fields.map((field) => ({ ...field, type: 'number' })),
      ),
    ],
  },
  {
    key: 'rd',
    title: '四、企业研究开发活动情况表（近三年）',
    fields: [],
  },
  {
    key: 'fee',
    title: '五、企业年度研究开发费用结构明细表',
    fields: [],
  },
  {
    key: 'ps',
    title: '六、上年度高新技术产品（服务）情况表',
    fields: [],
  },
  {
    key: 'innovation',
    title: '七、企业创新能力',
    fields: [
      {
        key: 'innovation_ip',
        label: '知识产权对企业竞争力的作用',
        type: 'textarea',
      },
      {
        key: 'innovation_transform',
        label: '科技成果转化情况',
        type: 'textarea',
      },
      {
        key: 'innovation_rd_mgmt',
        label: '研究开发组织管理水平',
        type: 'textarea',
      },
      {
        key: 'innovation_staff',
        label: '管理与科技人员情况',
        type: 'textarea',
      },
    ],
  },
  {
    key: 'standards',
    title: '八、（加分项）企业参与国家标准或行业标准制定情况汇总表',
    fields: [],
  },
];
