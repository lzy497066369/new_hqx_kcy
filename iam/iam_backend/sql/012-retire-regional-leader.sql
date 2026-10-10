-- Retire only the removed business persona, preserving users and company memberships.
UPDATE iam_user_app ua
JOIN iam_user_role ur ON ur.user_id = ua.user_id AND ur.app_code = ua.app_code
JOIN iam_role r ON r.id = ur.role_id AND r.app_code = ua.app_code
SET ua.status = 0
WHERE r.app_code = 'kjqb_client' AND r.role_code = 'region_leader';
UPDATE iam_role SET status = 0
WHERE app_code = 'kjqb_client' AND role_code = 'region_leader';
UPDATE iam_menu SET status = 0
WHERE app_code = 'kjqb_client'
  AND path IN ('/governance/enterprises', '/governance/project-accounts', '/governance/region-accounts');
