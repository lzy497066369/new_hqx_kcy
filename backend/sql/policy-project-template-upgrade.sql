ALTER TABLE `biz_policy_project`
  ADD COLUMN `policy_type` VARCHAR(128) DEFAULT NULL AFTER `name`,
  ADD COLUMN `applicable_objects` VARCHAR(255) DEFAULT NULL AFTER `policy_type`,
  ADD COLUMN `basic_description` TEXT DEFAULT NULL AFTER `applicable_objects`;
