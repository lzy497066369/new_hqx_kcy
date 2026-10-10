-- 资质申报主线项目库：按省级→国家级、普通→专精特新递进关系建立。
-- 项目仅定义统一事项与建议路径；地区前置条件、材料、评分、流程由地区申报方案配置。

INSERT INTO `biz_policy_project` (
  `code`, `name`, `policy_type`, `applicable_objects`, `basic_description`, `enabled`, `sort_num`, `remark`, `created_at`, `updated_at`
)
SELECT item.`code`, item.`name`, item.`policy_type`, item.`applicable_objects`, item.`basic_description`, 1, item.`sort_num`, item.`remark`, NOW(), NOW()
FROM (
  SELECT
    'QUAL_TECH_SME_PROVINCIAL' AS `code`,
    '省级科技型中小企业' AS `name`,
    '科技型中小企业' AS `policy_type`,
    '具备科技创新能力、符合本省评价口径的中小企业' AS `applicable_objects`,
    '科技型中小企业省级培育项目。多数地区将其作为国家级科技型中小企业的后备库，具体是否设置及申报条件以地区方案为准。' AS `basic_description`,
    10 AS `sort_num`,
    '主线：科技型中小企业（省级培育）→ 国家级科技型中小企业。' AS `remark`
  UNION ALL SELECT
    'QUAL_TECH_SME_NATIONAL',
    '国家级科技型中小企业',
    '科技型中小企业',
    '符合国家科技型中小企业评价要求的中小企业',
    '入门级国家科技资质，可作为研发费用加计扣除及部分项目申报的重要基础。地区可在申报方案中配置其是否作为其他事项的前置资格。',
    20,
    '主线：科技型中小企业国家级评价；可作为高企等项目的地区前置条件。'
  UNION ALL SELECT
    'QUAL_INNOVATIVE_SME_PROVINCIAL',
    '省级创新型中小企业',
    '创新型中小企业',
    '具备专业化、精细化、特色化、新颖化发展基础的中小企业',
    '专精特新体系第一站。通常作为申报省级专精特新中小企业的前提，具体条件和年度批次由地区方案配置。',
    30,
    '主线：省级创新型中小企业 → 省级专精特新中小企业。'
  UNION ALL SELECT
    'QUAL_SPECIALIZED_SME_PROVINCIAL',
    '省级专精特新中小企业',
    '专精特新企业',
    '符合本省专精特新中小企业认定条件的中小企业',
    '省级专精特新资质，通常具备资金奖励、培育支持等政策价值，并作为申报国家级专精特新“小巨人”的重要基础。',
    40,
    '主线：省级创新型中小企业 → 省级专精特新中小企业 → 专精特新“小巨人”企业。'
  UNION ALL SELECT
    'QUAL_SPECIALIZED_LITTLE_GIANT_NATIONAL',
    '专精特新“小巨人”企业',
    '专精特新企业',
    '符合工业和信息化部专精特新“小巨人”认定条件的企业',
    '国家级专精特新荣誉，由工业和信息化部认定。通常以省级专精特新中小企业为基础，实际前置条件以当年国家及地区方案为准。',
    50,
    '主线：省级专精特新中小企业 → 国家级专精特新“小巨人”企业。'
  UNION ALL SELECT
    'QUAL_KEY_LITTLE_GIANT_NATIONAL',
    '重点“小巨人”企业',
    '专精特新企业',
    '已获专精特新“小巨人”称号且符合重点支持条件的企业',
    '从专精特新“小巨人”企业中择优支持的重点培育项目，可配置中央财政奖补及地区配套支持的材料、评分和流程规则。',
    60,
    '主线：专精特新“小巨人”企业 → 重点“小巨人”企业。'
  UNION ALL SELECT
    'QUAL_HIGH_TECH_ENTERPRISE_NATIONAL',
    '国家高新技术企业',
    '高新技术企业',
    '符合国家高新技术企业认定要求的居民企业',
    '国家级高新技术企业认定，涉及核心自主知识产权、研发投入、科技人员、高新技术产品收入和创新能力评价等要求。部分地区可配置科技型中小企业等前置资格。',
    70,
    '国家高企主线；地区方案可配置“国家级科技型中小企业前置”等差异化规则。'
  UNION ALL SELECT
    'QUAL_HIGH_TECH_ENTERPRISE_RECOGNITION',
    '国家高新技术企业重新认定',
    '高新技术企业',
    '高新技术企业证书即将到期、需要重新认定的企业',
    '国家高新技术企业证书有效期满后的重新认定项目。与首次认定可复用大部分规则，但地区可单独配置年度材料、时间窗口和流程。',
    80,
    '高企续期主线；建议单独维护材料年度、时间节点与评分模型。'
) item
WHERE NOT EXISTS (
  SELECT 1
  FROM `biz_policy_project` existed
  WHERE existed.`code` = item.`code` OR existed.`name` = item.`name`
);
