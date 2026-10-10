-- 四层申报配置：固定指标字段目录 + 准入条件预设 + 项目区域配置单 + 节点执行规则。
-- 旧 enterprise 类型预设不删除，已发布方案和历史申报快照仍可追溯；新方案不再引用它。

UPDATE `sys_menu`
SET `title` = '企业指标字段目录',
    `path` = 'enterprise-metric-catalog',
    `component` = 'policy/preset/enterprise-metric-catalog',
    `icon` = 'lucide:database'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyEnterprisePreset';

UPDATE `sys_menu`
SET `title` = '准入条件预设',
    `icon` = 'lucide:badge-check'
WHERE `portal_type` = 'admin'
  AND `name` = 'PolicyQualificationPreset';

UPDATE `biz_declaration_preset`
SET `description` = CONCAT(COALESCE(`description`, ''), '（历史企业指标预设：新方案改由准入条件预设统一维护）')
WHERE `preset_type` = 'enterprise'
  AND `description` NOT LIKE '%历史企业指标预设%';
