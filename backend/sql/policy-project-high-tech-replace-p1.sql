-- 将历史“高新技术企业”项目原地替换为标准“国家高新技术企业”项目。
-- 保留旧项目 ID，确保既有企业申报、政策文件、材料要求等关联记录继续有效。

DELETE duplicate_project
FROM `biz_policy_project` duplicate_project
LEFT JOIN `biz_declaration_scheme` scheme ON scheme.`project_id` = duplicate_project.`id`
LEFT JOIN `biz_client_declaration` declaration ON declaration.`project_id` = duplicate_project.`id`
LEFT JOIN `biz_region_policy_file` policy_file ON policy_file.`project_id` = duplicate_project.`id`
LEFT JOIN `biz_project_material_requirement` requirement ON requirement.`project_id` = duplicate_project.`id`
WHERE duplicate_project.`id` = 18
  AND duplicate_project.`code` = 'QUAL_HIGH_TECH_ENTERPRISE_NATIONAL'
  AND scheme.`id` IS NULL
  AND declaration.`id` IS NULL
  AND policy_file.`id` IS NULL
  AND requirement.`id` IS NULL;

UPDATE `biz_policy_project`
SET `code` = 'QUAL_HIGH_TECH_ENTERPRISE_NATIONAL',
    `name` = '国家高新技术企业',
    `policy_type` = '高新技术企业',
    `applicable_objects` = '符合国家高新技术企业认定要求的居民企业',
    `basic_description` = '国家级高新技术企业认定，涉及核心自主知识产权、研发投入、科技人员、高新技术产品收入和创新能力评价等要求。部分地区可配置科技型中小企业等前置资格。',
    `enabled` = 1,
    `sort_num` = 70,
    `remark` = '国家高企主线；地区方案可配置“国家级科技型中小企业前置”等差异化规则。',
    `updated_at` = NOW()
WHERE `id` = 9
  AND `code` = 'POLICY_PROJECT_1782963512313_PD2TYJ';
