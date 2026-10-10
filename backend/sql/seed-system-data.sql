-- 系统初始化数�?-- 适用�? sys_dept, sys_role, sys_user, sys_menu, sys_permission, sys_user_role, sys_role_permission
-- 说明:
-- 1. 该文件基于当前后端的 MySQL 5.6 兼容结构编写
-- 2. 默认账号�?admin / 123456
-- 3. 角色和部门按“后台管�?+ 客户端业务协同”补�?
SET @@session.time_zone = '+08:00';

INSERT INTO `sys_dept` (
  `parent_id`,
  `name`,
  `status`,
  `remark`,
  `sort_num`,
  `ancestors`,
  `dept_type`,
  `parent_name`,
  `full_name`,
  `path`,
  `phone`,
  `email`,
  `leader`,
  `children_count`,
  `is_leaf`,
  `created_at`,
  `updated_at`
)
SELECT NULL, '总部', 1, '默认部门', 0, NULL, 'dept', NULL, '总部', NULL, NULL, NULL, NULL, 0, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dept` WHERE `name` = '总部');

INSERT INTO `sys_dept` (
  `parent_id`,
  `name`,
  `status`,
  `remark`,
  `sort_num`,
  `ancestors`,
  `dept_type`,
  `parent_name`,
  `full_name`,
  `path`,
  `phone`,
  `email`,
  `leader`,
  `children_count`,
  `is_leaf`,
  `created_at`,
  `updated_at`
)
SELECT NULL, '项目�?, 1, '项目审核与政策匹�?, 10, NULL, 'dept', NULL, '项目�?, NULL, NULL, NULL, NULL, 0, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dept` WHERE `name` = '项目�?);

INSERT INTO `sys_dept` (
  `parent_id`,
  `name`,
  `status`,
  `remark`,
  `sort_num`,
  `ancestors`,
  `dept_type`,
  `parent_name`,
  `full_name`,
  `path`,
  `phone`,
  `email`,
  `leader`,
  `children_count`,
  `is_leaf`,
  `created_at`,
  `updated_at`
)
SELECT NULL, '销售部', 1, '企业跟进与线索维�?, 20, NULL, 'dept', NULL, '销售部', NULL, NULL, NULL, NULL, 0, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dept` WHERE `name` = '销售部');

INSERT INTO `sys_dept` (
  `parent_id`,
  `name`,
  `status`,
  `remark`,
  `sort_num`,
  `ancestors`,
  `dept_type`,
  `parent_name`,
  `full_name`,
  `path`,
  `phone`,
  `email`,
  `leader`,
  `children_count`,
  `is_leaf`,
  `created_at`,
  `updated_at`
)
SELECT NULL, '管理�?, 1, '制度管理与人员统�?, 30, NULL, 'dept', NULL, '管理�?, NULL, NULL, NULL, NULL, 0, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dept` WHERE `name` = '管理�?);

INSERT INTO `sys_dept` (
  `parent_id`,
  `name`,
  `status`,
  `remark`,
  `sort_num`,
  `ancestors`,
  `dept_type`,
  `parent_name`,
  `full_name`,
  `path`,
  `phone`,
  `email`,
  `leader`,
  `children_count`,
  `is_leaf`,
  `created_at`,
  `updated_at`
)
SELECT NULL, '运营�?, 1, '内容运营与活动推�?, 40, NULL, 'dept', NULL, '运营�?, NULL, NULL, NULL, NULL, 0, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_dept` WHERE `name` = '运营�?);

INSERT INTO `sys_role` (`code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'admin', '系统管理�?, '默认管理员角�?, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `code` = 'admin');

INSERT INTO `sys_role` (`code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'project_teacher', '项目老师', '负责政策解析、项目审核和材料检�?, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `code` = 'project_teacher');

INSERT INTO `sys_role` (`code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'sales', '销售人�?, '负责企业跟进和线索维�?, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `code` = 'sales');

INSERT INTO `sys_role` (`code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'dept_manager', '部门经理', '负责部门管理、项目推进和数据汇�?, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `code` = 'dept_manager');

INSERT INTO `sys_role` (`code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'enterprise_owner', '企业负责�?, '企业端主账号，负责企业申报和资料确认', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `code` = 'enterprise_owner');

INSERT INTO `sys_role` (`code`, `name`, `remark`, `status`, `created_at`, `updated_at`)
SELECT 'enterprise_user', '企业用户', '企业端普通账号，负责资料补充和任务协�?, 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_role` WHERE `code` = 'enterprise_user');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `remark`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT 'admin', '123456', '系统管理�?, '/Dashboard/Workspace', d.id, d.name, '默认管理员用�?, 1, NOW(), NOW()
FROM `sys_dept` d
WHERE d.name = '总部'
  AND NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'admin');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `remark`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT 'teacher01', '123456', '项目老师', '/Dashboard/Workspace', d.id, d.name, '默认项目老师账号', 1, NOW(), NOW()
FROM `sys_dept` d
WHERE d.name = '项目�?
  AND NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'teacher01');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `remark`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT 'sales01', '123456', '销售人�?, '/Dashboard/Workspace', d.id, d.name, '默认销售人员账�?, 1, NOW(), NOW()
FROM `sys_dept` d
WHERE d.name = '销售部'
  AND NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'sales01');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `remark`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT 'manager01', '123456', '部门经理', '/Dashboard/Workspace', d.id, d.name, '默认部门经理账号', 1, NOW(), NOW()
FROM `sys_dept` d
WHERE d.name = '管理�?
  AND NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'manager01');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `remark`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT 'enterprise_owner01', '123456', '企业负责�?, '/Dashboard/Workspace', d.id, d.name, '默认企业负责人账�?, 1, NOW(), NOW()
FROM `sys_dept` d
WHERE d.name = '运营�?
  AND NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'enterprise_owner01');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `remark`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT 'enterprise_user01', '123456', '企业用户', '/Dashboard/Workspace', d.id, d.name, '默认企业普通用户账�?, 1, NOW(), NOW()
FROM `sys_dept` d
WHERE d.name = '运营�?
  AND NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'enterprise_user01');

INSERT INTO `sys_user` (
  `username`,
  `password`,
  `real_name`,
  `home_path`,
  `dept_id`,
  `dept_name`,
  `remark`,
  `status`,
  `created_at`,
  `updated_at`
)
SELECT 'client_user01', '123456', '企业用户示例', '/home', d.id, d.name, '仅分配企业用户角色的客户端示例账�?, 1, NOW(), NOW()
FROM `sys_dept` d
WHERE d.name = '运营�?
  AND NOT EXISTS (SELECT 1 FROM `sys_user` WHERE `username` = 'client_user01');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_100100', '系统管理', 'catalog', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_100100');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_ROOT', '客户�?, 'catalog', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_ROOT');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_100100', '客户�?企业资料', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_100100');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_100200', '客户�?申报项目', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_100200');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_100300', '客户�?政策中心', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_100300');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_100400', '客户�?内容中心', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_100400');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_100500', '客户�?企业负责�?, 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_100500');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_100600', '客户�?企业用户', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_100600');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'AC_CLIENT_100700', '客户�?政策问答', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'AC_CLIENT_100700');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT NULL, 'Dashboard', '/Dashboard', NULL, '/Dashboard/Workspace', 'catalog', 'lucide:layout-dashboard', 'page.dashboard.title', -1, 1, NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'Dashboard');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT NULL, 'System', '/system', NULL, '/system/user', 'catalog', 'ion:settings-outline', 'system.title', 9997, 1, 'AC_100100', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'System');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT NULL, 'Client', '/', NULL, '/home', 'catalog', 'mdi:cellphone', '客户�?, 100, 1, 'AC_CLIENT_ROOT', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'Client');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'Workspace', '/Dashboard/Workspace', 'dashboard/workspace/index', NULL, 'menu', 'carbon:workspace', 'page.dashboard.workspace', 1, 1, NULL, NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Dashboard'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'Workspace');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'Analytics', '/Dashboard/Analytics', 'dashboard/analytics/index', NULL, 'menu', 'lucide:area-chart', 'page.dashboard.analytics', 2, 1, NULL, NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Dashboard'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'Analytics');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'SystemUser', 'user', 'system/user/list', NULL, 'menu', 'mdi:user', 'system.user.title', 1, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'System'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemUser');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'SystemRole', 'role', 'system/role/list', NULL, 'menu', 'mdi:account-group', 'system.role.title', 2, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'System'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemRole');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'SystemMenu', 'menu', 'system/menu/list', NULL, 'menu', 'mdi:menu', 'system.menu.title', 3, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'System'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemMenu');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'SystemDept', 'dept', 'system/dept/list', NULL, 'menu', 'charm:organisation', 'system.dept.title', 4, 1, 'AC_100100', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'System'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'SystemDept');
INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:List', '��ҵ�����б�', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:Create', '������ҵ����', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:Edit', '�༭��ҵ����', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Profile:Delete', 'ɾ����ҵ����', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Profile:Delete');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:List'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:Create'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:Edit'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code = 'Enterprise:Profile:Delete'
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT NULL, 'Enterprise', '/enterprise', NULL, '/enterprise/profile', 'catalog', 'mdi:domain', 'system.enterprise.title', 3, 1, 'Enterprise:Profile:List', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `path` = '/enterprise');

INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT parent.id, 'EnterpriseProfile', 'profile', 'enterprise/profile/list', NULL, 'menu', 'mdi:office-building', 'system.enterprise.profile.name', 1, 1, 'Enterprise:Profile:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Enterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'EnterpriseProfile');
INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:List', '��ҵ�������б�', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:Create', '������ҵ������', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:Edit', '�༭��ҵ������', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:Owner:Delete', 'ɾ����ҵ������', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:Owner:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:List', '��ҵ�û��б�', 'menu', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:List');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:Create', '������ҵ�û�', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:Edit', '�༭��ҵ�û�', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Enterprise:User:Delete', 'ɾ����ҵ�û�', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Enterprise:User:Delete');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p ON p.code IN (
  'Enterprise:Owner:List',
  'Enterprise:Owner:Create',
  'Enterprise:Owner:Edit',
  'Enterprise:Owner:Delete',
  'Enterprise:User:List',
  'Enterprise:User:Create',
  'Enterprise:User:Edit',
  'Enterprise:User:Delete'
)
WHERE r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM `sys_role_permission` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'EnterpriseOwner', 'owner', 'enterprise/owner/list', NULL, 'menu', 'mdi:account-tie', 'system.enterprise.owner.name', 2, 1, 'Enterprise:Owner:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Enterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'EnterpriseOwner');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'EnterpriseUser', 'user', 'enterprise/user/list', NULL, 'menu', 'mdi:account', 'system.enterprise.user.name', 3, 1, 'Enterprise:User:List', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Enterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'EnterpriseUser');
INSERT INTO `sys_menu` (
  `parent_id`,
  `name`,
  `path`,
  `component`,
  `redirect_path`,
  `menu_type`,
  `icon`,
  `title`,
  `order_num`,
  `status`,
  `auth_code`,
  `created_at`,
  `updated_at`
)
SELECT parent.id, 'ClientEnterprise', '/company/profile', 'client/enterprise/index', NULL, 'menu', 'mdi:domain', '企业资料', 1, 1, 'AC_CLIENT_100100', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Client'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterprise');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'ClientDeclare', '/materials', 'client/declare/index', NULL, 'menu', 'mdi:file-document-edit', '申报项目', 2, 1, 'AC_CLIENT_100200', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Client'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientDeclare');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'ClientPolicy', '/policy', 'client/policy/index', NULL, 'menu', 'mdi:newspaper-variant-outline', '政策中心', 3, 1, 'AC_CLIENT_100300', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Client'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicy');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'ClientContent', '/content', 'client/content/index', NULL, 'menu', 'mdi:book-open-page-variant-outline', '内容中心', 4, 1, 'AC_CLIENT_100400', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Client'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientContent');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'ClientEnterpriseOwner', '/company/owners', 'client/enterprise-owner/index', NULL, 'menu', 'mdi:account-tie', '企业负责�?, 5, 1, 'AC_CLIENT_100500', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Client'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseOwner');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'ClientEnterpriseUser', '/company/users', 'client/enterprise-user/index', NULL, 'menu', 'mdi:account', '企业用户', 6, 1, 'AC_CLIENT_100600', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Client'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseUser');

INSERT INTO `sys_menu` (
  `parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`
)
SELECT parent.id, 'ClientPolicyQuery', '/policy/query', 'client/policy-query/index', NULL, 'menu', 'mdi:magnify', '政策问答', 7, 1, 'AC_CLIENT_100700', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'Client'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicyQuery');

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r
WHERE u.username = 'admin'
  AND r.code = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_user_role` ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r
WHERE u.username = 'teacher01'
  AND r.code = 'project_teacher'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_user_role` ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r
WHERE u.username = 'sales01'
  AND r.code = 'sales'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_user_role` ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r
WHERE u.username = 'manager01'
  AND r.code = 'dept_manager'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_user_role` ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r
WHERE u.username = 'enterprise_owner01'
  AND r.code = 'enterprise_owner'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_user_role` ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r
WHERE u.username = 'enterprise_user01'
  AND r.code = 'enterprise_user'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_user_role` ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `sys_user_role` (`user_id`, `role_id`, `created_at`, `updated_at`)
SELECT u.id, r.id, NOW(), NOW()
FROM `sys_user` u
JOIN `sys_role` r
WHERE u.username = 'client_user01'
  AND r.code = 'enterprise_user'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_user_role` ur WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code = 'admin'
  AND p.code = 'AC_100100'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_ROOT'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_100100'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_100200'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_100300'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_100400'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_100500'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_100600'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'AC_CLIENT_100700'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Enterprise:Create', '新增企业资料', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Enterprise:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Enterprise:Edit', '修改企业资料', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Enterprise:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Enterprise:Delete', '删除企业资料', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Enterprise:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Declare:Create', '新增申报项目', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Declare:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Declare:Edit', '修改申报项目', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Declare:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Declare:Delete', '删除申报项目', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Declare:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Policy:Create', '新增政策中心', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Policy:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Policy:Edit', '修改政策中心', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Policy:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Policy:Delete', '删除政策中心', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Policy:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Content:Create', '新增内容中心', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Content:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Content:Edit', '修改内容中心', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Content:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:Content:Delete', '删除内容中心', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:Content:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:EnterpriseOwner:Create', '新增企业负责�?, 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:EnterpriseOwner:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:EnterpriseOwner:Edit', '修改企业负责�?, 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:EnterpriseOwner:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:EnterpriseOwner:Delete', '删除企业负责�?, 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:EnterpriseOwner:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:EnterpriseUser:Create', '新增企业用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:EnterpriseUser:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:EnterpriseUser:Edit', '修改企业用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:EnterpriseUser:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:EnterpriseUser:Delete', '删除企业用户', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:EnterpriseUser:Delete');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:PolicyQuery:Create', '新增政策问答', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:PolicyQuery:Create');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:PolicyQuery:Edit', '修改政策问答', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:PolicyQuery:Edit');

INSERT INTO `sys_permission` (`code`, `name`, `type`, `status`, `created_at`, `updated_at`)
SELECT 'Client:PolicyQuery:Delete', '删除政策问答', 'button', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `sys_permission` WHERE `code` = 'Client:PolicyQuery:Delete');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseCreate', 'enterprise-create', NULL, NULL, 'button', NULL, '新增企业资料', 1, 1, 'Client:Enterprise:Create', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseCreate');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseEdit', 'enterprise-edit', NULL, NULL, 'button', NULL, '修改企业资料', 2, 1, 'Client:Enterprise:Edit', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseEdit');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseDelete', 'enterprise-delete', NULL, NULL, 'button', NULL, '删除企业资料', 3, 1, 'Client:Enterprise:Delete', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterprise'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseDelete');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientDeclareCreate', 'declare-create', NULL, NULL, 'button', NULL, '新增申报项目', 1, 1, 'Client:Declare:Create', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientDeclare'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientDeclareCreate');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientDeclareEdit', 'declare-edit', NULL, NULL, 'button', NULL, '修改申报项目', 2, 1, 'Client:Declare:Edit', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientDeclare'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientDeclareEdit');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientDeclareDelete', 'declare-delete', NULL, NULL, 'button', NULL, '删除申报项目', 3, 1, 'Client:Declare:Delete', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientDeclare'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientDeclareDelete');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientPolicyCreate', 'policy-create', NULL, NULL, 'button', NULL, '新增政策中心', 1, 1, 'Client:Policy:Create', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientPolicy'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicyCreate');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientPolicyEdit', 'policy-edit', NULL, NULL, 'button', NULL, '修改政策中心', 2, 1, 'Client:Policy:Edit', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientPolicy'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicyEdit');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientPolicyDelete', 'policy-delete', NULL, NULL, 'button', NULL, '删除政策中心', 3, 1, 'Client:Policy:Delete', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientPolicy'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicyDelete');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientContentCreate', 'content-create', NULL, NULL, 'button', NULL, '新增内容中心', 1, 1, 'Client:Content:Create', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientContent'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientContentCreate');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientContentEdit', 'content-edit', NULL, NULL, 'button', NULL, '修改内容中心', 2, 1, 'Client:Content:Edit', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientContent'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientContentEdit');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientContentDelete', 'content-delete', NULL, NULL, 'button', NULL, '删除内容中心', 3, 1, 'Client:Content:Delete', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientContent'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientContentDelete');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseOwnerCreate', 'enterprise-owner-create', NULL, NULL, 'button', NULL, '新增企业负责�?, 1, 1, 'Client:EnterpriseOwner:Create', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterpriseOwner'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseOwnerCreate');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseOwnerEdit', 'enterprise-owner-edit', NULL, NULL, 'button', NULL, '修改企业负责�?, 2, 1, 'Client:EnterpriseOwner:Edit', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterpriseOwner'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseOwnerEdit');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseOwnerDelete', 'enterprise-owner-delete', NULL, NULL, 'button', NULL, '删除企业负责�?, 3, 1, 'Client:EnterpriseOwner:Delete', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterpriseOwner'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseOwnerDelete');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseUserCreate', 'enterprise-user-create', NULL, NULL, 'button', NULL, '新增企业用户', 1, 1, 'Client:EnterpriseUser:Create', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterpriseUser'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseUserCreate');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseUserEdit', 'enterprise-user-edit', NULL, NULL, 'button', NULL, '修改企业用户', 2, 1, 'Client:EnterpriseUser:Edit', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterpriseUser'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseUserEdit');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientEnterpriseUserDelete', 'enterprise-user-delete', NULL, NULL, 'button', NULL, '删除企业用户', 3, 1, 'Client:EnterpriseUser:Delete', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientEnterpriseUser'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientEnterpriseUserDelete');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientPolicyQueryCreate', 'policy-query-create', NULL, NULL, 'button', NULL, '新增政策问答', 1, 1, 'Client:PolicyQuery:Create', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientPolicyQuery'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicyQueryCreate');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientPolicyQueryEdit', 'policy-query-edit', NULL, NULL, 'button', NULL, '修改政策问答', 2, 1, 'Client:PolicyQuery:Edit', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientPolicyQuery'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicyQueryEdit');

INSERT INTO `sys_menu` (`parent_id`, `name`, `path`, `component`, `redirect_path`, `menu_type`, `icon`, `title`, `order_num`, `status`, `auth_code`, `created_at`, `updated_at`)
SELECT parent.id, 'ClientPolicyQueryDelete', 'policy-query-delete', NULL, NULL, 'button', NULL, '删除政策问答', 3, 1, 'Client:PolicyQuery:Delete', NOW(), NOW()
FROM `sys_menu` parent
WHERE parent.name = 'ClientPolicyQuery'
  AND NOT EXISTS (SELECT 1 FROM `sys_menu` WHERE `name` = 'ClientPolicyQueryDelete');

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Enterprise:Create'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Enterprise:Edit'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Enterprise:Delete'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Declare:Create'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Declare:Edit'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Declare:Delete'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Policy:Create'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Policy:Edit'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Policy:Delete'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Content:Create'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Content:Edit'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:Content:Delete'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager')
  AND p.code = 'Client:EnterpriseOwner:Create'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager')
  AND p.code = 'Client:EnterpriseOwner:Edit'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager')
  AND p.code = 'Client:EnterpriseOwner:Delete'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager')
  AND p.code = 'Client:EnterpriseUser:Create'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager')
  AND p.code = 'Client:EnterpriseUser:Edit'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager')
  AND p.code = 'Client:EnterpriseUser:Delete'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:PolicyQuery:Create'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:PolicyQuery:Edit'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

INSERT INTO `sys_role_permission` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.id, p.id, NOW(), NOW()
FROM `sys_role` r
JOIN `sys_permission` p
WHERE r.code IN ('admin', 'project_teacher', 'sales', 'dept_manager', 'enterprise_owner', 'enterprise_user')
  AND p.code = 'Client:PolicyQuery:Delete'
  AND NOT EXISTS (SELECT 1 FROM `sys_role_permission` rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
