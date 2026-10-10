-- 验收示例：国家高新技术企业在指定地区申报时，企业需持有有效国家科技型中小企业证书且成立满 365 天。
-- 仅新增预设与草稿方案；发布前请在后台补齐材料、评分、流程预设后再发布。

INSERT INTO `biz_declaration_preset` (
  `preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`
)
SELECT
  'qualification',
  '高企-国家科技型中小企业前置',
  'v1',
  'published',
  '验收示例：需存在有效国家科技型中小企业证书，且企业成立天数不少于 365 天。',
  '{"mode":"all","rules":[{"type":"certificate_exists","certificateType":"NATIONAL_TECH_SME"},{"type":"metric","key":"enterprise_age_days","operator":"gte","value":365}]}',
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'qualification'
    AND `name` = '高企-国家科技型中小企业前置'
    AND `version` = 'v1'
);
