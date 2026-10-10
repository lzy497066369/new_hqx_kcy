-- 默认申报预设：可直接被地区申报方案引用，后续可在预设页面复制为新版本调整。

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'enterprise', '科技型中小企业', 'v1', 'published', '适用于科技型中小企业评价及前置资格识别。', '{"enterpriseType":"科技型中小企业","applicableObjects":"具有科技研发活动的中小企业"}', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'enterprise' AND `name` = '科技型中小企业' AND `version` = 'v1'
);

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'enterprise', '高新技术企业', 'v1', 'published', '适用于国家高新技术企业认定。', '{"enterpriseType":"高新技术企业","applicableObjects":"具备自主研发和成果转化基础的科技企业"}', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'enterprise' AND `name` = '高新技术企业' AND `version` = 'v1'
);

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'qualification', '无前置资质要求', 'v1', 'published', '不要求企业先具备特定资质。', '{"mode":"all","rules":[]}', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'qualification' AND `name` = '无前置资质要求' AND `version` = 'v1'
);

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'qualification', '科技型中小企业前置', 'v1', 'published', '企业必须拥有有效的科技型中小企业资质。', '{"mode":"all","rules":[{"code":"TECH_SME","name":"科技型中小企业","type":"certificate"}]}', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'qualification' AND `name` = '科技型中小企业前置' AND `version` = 'v1'
);

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'material', '科技型中小企业基础材料', 'v1', 'published', '适用于科技型中小企业评价的基础资料。', '[{"attachmentRequired":0,"itemName":"企业基本信息","moduleKey":"basic","requiredCount":1,"tabKey":"info"},{"attachmentRequired":1,"itemName":"企业证书","moduleKey":"certificate","requiredCount":1,"tabKey":"certificates"}]', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'material' AND `name` = '科技型中小企业基础材料' AND `version` = 'v1'
);

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'material', '高企申报材料', 'v1', 'published', '覆盖企业基础、科技人员、知识产权和研发项目。', '[{"attachmentRequired":0,"itemName":"企业基本信息","moduleKey":"basic","requiredCount":1,"tabKey":"info"},{"attachmentRequired":1,"itemName":"科技人员","moduleKey":"employee","requiredCount":1,"tabKey":"employees"},{"attachmentRequired":1,"itemName":"知识产权","moduleKey":"property","requiredCount":1,"tabKey":"intellectualProperty"},{"attachmentRequired":1,"itemName":"研发项目","moduleKey":"property","requiredCount":1,"tabKey":"researchProject"}]', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'material' AND `name` = '高企申报材料' AND `version` = 'v1'
);

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'score', '科技型中小企业评分模型', 'v1', 'published', '以材料准备度、研发项目和科技人员为基础测算。', '{"passScore":60,"items":[{"label":"材料准备度","maxScore":60,"method":"ratio","source":"material_readiness","threshold":100},{"label":"研发项目","maxScore":20,"method":"threshold","source":"property.rd_count","threshold":1},{"label":"科技人员","maxScore":20,"method":"threshold","source":"tech_employee_count","threshold":1}]}', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'score' AND `name` = '科技型中小企业评分模型' AND `version` = 'v1'
);

INSERT INTO `biz_declaration_preset` (`preset_type`, `name`, `version`, `status`, `description`, `payload_json`, `created_at`, `updated_at`)
SELECT 'score', '高企评分模型', 'v1', 'published', '以材料、知识产权、研发项目和科技人员占比测算。', '{"passScore":60,"items":[{"label":"材料准备度","maxScore":30,"method":"ratio","source":"material_readiness","threshold":100},{"label":"知识产权","maxScore":30,"method":"ladder","source":"ip_count","ladder":[{"min":1,"score":12},{"min":3,"score":22},{"min":6,"score":30}]},{"label":"研发项目","maxScore":20,"method":"ladder","source":"property.rd_count","ladder":[{"min":1,"score":8},{"min":3,"score":16},{"min":5,"score":20}]},{"label":"科技人员占比","maxScore":20,"method":"ratio","source":"tech_employee_ratio","threshold":20}]}', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `biz_declaration_preset`
  WHERE `preset_type` = 'score' AND `name` = '高企评分模型' AND `version` = 'v1'
);
