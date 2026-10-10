-- Persist the applicant-selected region so declarations of one project remain independent by region.

ALTER TABLE `biz_client_declaration`
  ADD COLUMN `declaration_region_id` BIGINT DEFAULT NULL AFTER `policy_file_ids`,
  ADD KEY `idx_biz_client_declaration_enterprise_project_region` (`enterprise_id`, `project_id`, `declaration_region_id`);
