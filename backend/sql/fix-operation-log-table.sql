-- 手工兜底脚本：仅修复 sys_operation_log 时间列默认值。
-- 一般优先执行 operation-log-patch.sql；只有已确认问题仅在时间列时再执行本文件。

ALTER TABLE `sys_operation_log`
  MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
