-- Backfills CRM-created national high-tech declarations with the published default scheme.
-- The declaration detail page reads scheme_id first, so snapshot_json is left unchanged
-- for compatibility with older MySQL versions that may not support JSON_SET.

UPDATE `biz_client_declaration` declaration
JOIN `biz_policy_project` project
  ON project.`id` = declaration.`project_id`
JOIN (
  SELECT scheme.`project_id`, scheme.`id`, scheme.`version`
  FROM `biz_declaration_scheme` scheme
  JOIN (
    SELECT `project_id`, MAX(CAST(`id` AS UNSIGNED)) AS `scheme_id`
    FROM `biz_declaration_scheme`
    WHERE `status` = 'published'
      AND `region_id` IS NULL
    GROUP BY `project_id`
  ) latest
    ON latest.`project_id` = scheme.`project_id`
   AND latest.`scheme_id` = CAST(scheme.`id` AS UNSIGNED)
  WHERE scheme.`status` = 'published'
    AND scheme.`region_id` IS NULL
) default_scheme
  ON default_scheme.`project_id` = declaration.`project_id`
SET declaration.`scheme_id` = default_scheme.`id`,
    declaration.`scheme_version` = default_scheme.`version`,
    declaration.`updated_at` = NOW()
WHERE project.`code` = 'QUAL_HIGH_TECH_ENTERPRISE_NATIONAL'
  AND declaration.`scheme_id` IS NULL
  AND declaration.`snapshot_json` LIKE '%"createdFrom":"crm_execution_order"%';
