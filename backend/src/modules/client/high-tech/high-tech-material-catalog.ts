export const BOOK_SECTIONS = [
  { key: 'profile', title: '企业简介' },
  { key: 'main', title: '一、主要情况' },
  { key: 'ip', title: '二、知识产权汇总表' },
  { key: 'hr', title: '三、人力资源情况表' },
  { key: 'rd', title: '四、企业研究开发活动情况表（近三年）' },
  { key: 'fee', title: '五、研发费用结构明细' },
  { key: 'ps', title: '六、上年度高新技术产品（服务）情况表' },
  { key: 'innovation_ip', title: '七、企业创新能力：知识产权竞争力' },
  { key: 'innovation_transform', title: '七、企业创新能力：科技成果转化' },
  { key: 'innovation_organization', title: '七、企业创新能力：研发组织管理' },
  { key: 'innovation_staff', title: '七、企业创新能力：管理与科技人员' },
  { key: 'standards', title: '八、标准制定加分项' },
] as const;

export const ATTACHMENT_SECTIONS = [
  { key: 'cover', title: '申请书封皮' },
  { key: 'application_pdf', title: '高新技术企业认定申请书' },
  { key: 'business_license', title: '企业营业执照' },
  { key: 'ip', title: 'IP（知识产权）相关材料' },
  { key: 'staff_statement', title: '企业人员相关资料' },
  { key: 'rd_project_table', title: 'RD（研究开发活动）相关资料' },
  { key: 'rd_expense_audit', title: '近三年研发费用专项审计报告' },
  { key: 'hitech_products', title: 'PS（高新产品/服务）相关资料' },
  { key: 'hitech_income_audit', title: '近一年高新产品/服务收入专项审计报告' },
  { key: 'achievement_transform', title: '科技成果转化说明材料' },
  { key: 'system_docs', title: '研究开发组织管理水平证明材料' },
  { key: 'annual_audit', title: '财务审计报表' },
  { key: 'tax_settlement', title: '企业所得税纳税申报表其他说明材料' },
  { key: 'commitment', title: '国家网告知承诺书' },
] as const;
export type BookKey = (typeof BOOK_SECTIONS)[number]['key'];
export type AttachmentKey = (typeof ATTACHMENT_SECTIONS)[number]['key'];

export const GENERATABLE_ATTACHMENTS = {
  staff_statement: '企业人员情况说明：依据人数及社保人数说明人员情况；缺少人员名单、劳动合同和社保证明时标记待补充。',
  rd_project_table: 'RD项目立项和结题材料：按RD编号逐项列出项目名称、周期、领域、对应知识产权及成果；没有验收证据时不可声称结题或验收通过。',
  hitech_products: 'PS产品（服务）汇总及情况说明：按PS编号归集名称、技术领域、对应RD、知识产权和成果；收入、合同及检测数据缺失时标记待补充。',
  achievement_transform: '科技成果转化明细及说明：按成果编号列出成果、对应RD/PS、知识产权和转化状态；没有销售或应用证据时不得声称转化完成。',
  system_docs: '研发组织管理制度草稿：说明项目立项、研发费用归集、研发机构、产学研合作、成果转化和人员激励等制度框架；未证实的既有制度只能写建议条款或待补充，不得冒充已颁布制度。',
} as const satisfies Partial<Record<AttachmentKey, string>>;
export type GeneratableAttachmentKey = keyof typeof GENERATABLE_ATTACHMENTS;
