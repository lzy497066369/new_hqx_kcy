// Keep this layout identical in the client and backend so editing and exports agree.
export interface MainSituationCell {
  label?: string;
  field?: string;
  columnSpan?: number;
  rowSpan?: number;
  scope?: 'col' | 'row' | 'rowgroup';
}

// Extra grid boundaries allow the financial and R&D groups to share one table.
export const MAIN_SITUATION_COLUMN_WIDTHS = [13, 15, 3, 18, 20, 15.5, 15.5];

export function mainSituationRows(year: number): MainSituationCell[][] {
  return [
    [
      { label: '技术领域', scope: 'row' },
      { field: 'tech_field', columnSpan: 6 },
    ],
    [
      { label: '获得知识产权数量（件）', scope: 'row' },
      { label: 'Ⅰ类', scope: 'row' },
      { field: 'ip_class1_count', columnSpan: 2 },
      { label: 'Ⅱ类', scope: 'row' },
      { field: 'ip_class2_count', columnSpan: 2 },
    ],
    [
      { label: '人力资源情况（人）', scope: 'row' },
      { label: '职工总数', scope: 'row' },
      { field: 'staff_total', columnSpan: 2 },
      { label: '科技人员数', scope: 'row' },
      { field: 'tech_staff', columnSpan: 2 },
    ],
    [
      { label: '近三年经营情况（万元）', rowSpan: 4, scope: 'rowgroup' },
      { label: '年度', scope: 'col' },
      { label: '净资产', columnSpan: 2, scope: 'col' },
      { label: '销售收入', scope: 'col' },
      { label: '利润总额', columnSpan: 2, scope: 'col' },
    ],
    ...[1, 2, 3].map((offset): MainSituationCell[] => [
      { label: String(year - 4 + offset), scope: 'row' },
      { field: `year${offset}_net_assets`, columnSpan: 2 },
      { field: `year${offset}_sales` },
      { field: `year${offset}_profit`, columnSpan: 2 },
    ]),
    [
      {
        label: '近三年研究开发费用总额（万元）',
        columnSpan: 3,
        rowSpan: 2,
        scope: 'rowgroup',
      },
      { field: 'rd_total_3y', rowSpan: 2 },
      { label: '其中：', rowSpan: 2, scope: 'rowgroup' },
      { label: '在中国境内研发费用总额（万元）', scope: 'row' },
      { field: 'rd_domestic' },
    ],
    [
      { label: '基础研究投入费用总额（万元）', scope: 'row' },
      { field: 'rd_basic' },
    ],
    [
      { label: '近一年企业总收入（万元）', columnSpan: 4, scope: 'row' },
      { field: 'revenue_1y', columnSpan: 3 },
    ],
    [
      {
        label: '近一年高新技术产品（服务）收入（万元）',
        columnSpan: 4,
        scope: 'row',
      },
      { field: 'hitech_revenue', columnSpan: 3 },
    ],
    [
      {
        label:
          '申请认定前一年内是否发生过重大安全、重大质量事故或严重环境违法行为',
        columnSpan: 4,
        scope: 'row',
      },
      { field: 'accident', columnSpan: 3 },
    ],
  ];
}
