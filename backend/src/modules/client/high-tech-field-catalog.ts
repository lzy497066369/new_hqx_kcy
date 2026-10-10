export type HighTechFieldCatalogItem = {
  field: string;
  keywords: string[];
  topLevel: string;
};

// 摘编自《国家重点支持的高新技术领域》，用于约束 AI 的分类输出和离线兜底。
export const HIGH_TECH_FIELD_CATALOG: HighTechFieldCatalogItem[] = [
  { topLevel: '电子信息', field: '软件', keywords: ['软件', '系统', '平台', '算法', '数据', '云', '人工智能', '大数据'] },
  { topLevel: '电子信息', field: '微电子技术', keywords: ['芯片', '集成电路', '半导体', '传感器', '嵌入式'] },
  { topLevel: '电子信息', field: '计算机及网络技术', keywords: ['网络', '通信', '物联网', '安全', '区块链', '终端'] },
  { topLevel: '电子信息', field: '通信技术', keywords: ['无线', '5G', '通信', '信号', '卫星通信'] },
  { topLevel: '生物与新医药', field: '医药生物技术', keywords: ['生物', '疫苗', '基因', '细胞', '蛋白', '诊断'] },
  { topLevel: '生物与新医药', field: '中药、天然药物', keywords: ['中药', '天然药物', '药材', '提取', '制剂'] },
  { topLevel: '生物与新医药', field: '医疗仪器、设备与医学专用软件', keywords: ['医疗', '医学', '诊疗', '影像', '检验', '医疗器械'] },
  { topLevel: '航空航天', field: '航空技术', keywords: ['航空', '飞机', '飞行', '无人机', '航电'] },
  { topLevel: '航空航天', field: '航天技术', keywords: ['航天', '卫星', '火箭', '空间', '遥感'] },
  { topLevel: '新材料', field: '高性能结构材料技术', keywords: ['合金', '金属材料', '复合材料', '高分子', '碳纤维'] },
  { topLevel: '新材料', field: '新型功能材料技术', keywords: ['功能材料', '纳米', '膜材料', '稀土', '导电', '陶瓷'] },
  { topLevel: '高技术服务', field: '研发与设计服务', keywords: ['研发设计', '工业设计', '工程设计', '仿真', '测试'] },
  { topLevel: '高技术服务', field: '检验检测认证与标准服务', keywords: ['检测', '检验', '认证', '标准', '计量'] },
  { topLevel: '高技术服务', field: '信息技术服务', keywords: ['信息服务', '运维', '数据服务', 'SaaS', '咨询'] },
  { topLevel: '新能源与节能', field: '可再生清洁能源技术', keywords: ['新能源', '光伏', '风电', '储能', '氢能', '电池'] },
  { topLevel: '新能源与节能', field: '节能技术', keywords: ['节能', '能效', '余热', '低碳', '节电'] },
  { topLevel: '资源与环境', field: '环境保护与资源综合利用技术', keywords: ['环保', '环境', '污水', '废气', '固废', '资源回收'] },
  { topLevel: '先进制造与自动化', field: '先进制造技术', keywords: ['制造', '加工', '装备', '机器人', '数控', '自动化'] },
  { topLevel: '先进制造与自动化', field: '新型机械', keywords: ['机械', '机床', '传动', '工业设备', '智能装备'] },
  { topLevel: '先进制造与自动化', field: '智能交通和轨道交通技术', keywords: ['交通', '轨道', '车辆', '物流', '导航'] },
];

export const HIGH_TECH_FIELD_CATALOG_BY_NAME = HIGH_TECH_FIELD_CATALOG.map(
  ({ field, topLevel }) => `${topLevel} / ${field}`,
);
