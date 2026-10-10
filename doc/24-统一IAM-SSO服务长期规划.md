# 24-统一 IAM/SSO 服务长期规划

## 1. 背景与目标

当前项目已经具备登录、用户、角色、权限码、菜单、企业用户、企业负责人、项目老师等基础能力，但这些能力仍然内聚在当前业务系统中，且主要通过 `portal_type=admin/client` 区分后台端和客户端。随着后续四五个系统陆续接入，继续在每个系统内复制登录、用户、权限、菜单和公司授权逻辑，会带来账号割裂、权限重复配置、公司数据授权不一致、审计分散、跨系统登录体验差等问题。

长期目标是拆出独立的 IAM/SSO 服务，作为统一身份与访问控制中心。所有业务系统通过标准协议接入 IAM，不再各自维护登录态和通用权限模型。

IAM 负责：

- 用户身份：账号、密码、手机号、邮箱、状态、登录安全。
- 应用接入：系统注册、客户端凭据、回调地址、登出地址。
- SSO 认证：统一登录、统一退出、Token 签发和刷新。
- 访问授权：角色、权限码、菜单、用户角色绑定。
- 公司范围：公司主数据摘要、用户可访问公司、默认公司、公司内身份。
- 审计治理：登录日志、授权变更日志、Token 风险控制。

业务系统负责：

- 自己的业务数据、业务流程、业务规则、报表和页面实现。
- 业务接口基于 IAM Token 做身份识别、功能权限和数据范围校验。
- 必要时维护业务系统私有的扩展授权，但不再重复维护通用用户体系。

## 2. 总体架构

### 2.1 服务划分

建议拆分为一个独立 IAM 后端、一个 IAM 管理后台、一组接入 SDK/公共包，以及各业务系统。

```text
统一 IAM/SSO 服务
- iam-auth: 登录、授权码、Token、刷新、退出、JWKS
- iam-user: 用户、账号、安全策略、密码管理
- iam-app: 应用注册、OAuth Client、回调地址、应用状态
- iam-access: 角色、权限码、菜单、用户角色绑定
- iam-company: 公司主数据摘要、用户公司范围、默认公司
- iam-audit: 登录日志、授权变更日志、风控记录

IAM 管理后台
- 用户管理
- 应用管理
- 角色权限管理
- 菜单管理
- 公司授权管理
- 审计日志

业务系统 A/B/C/D/E
- 通过 OAuth2/OIDC 登录
- 通过 JWT 验签识别用户
- 通过权限码控制接口和按钮
- 通过公司范围控制业务数据

公共接入 SDK
- 前端 auth client
- 后端 auth guard
- 后端 permission guard
- 后端 company scope guard
```

### 2.2 推荐协议

推荐采用 `OAuth2 Authorization Code + PKCE`，并尽量兼容 OIDC。

使用标准协议的好处：

- 前端系统可统一跳转 IAM 登录页。
- 后端系统可本地验签 JWT，减少每次请求查 IAM 的压力。
- 后续接入第三方系统、移动端、桌面端时扩展成本低。
- 支持统一登出、Token 轮换、密钥轮换和多应用隔离。

### 2.3 核心边界

IAM 只管“谁能进、能做什么、能看哪些公司”。业务系统仍然保留具体业务数据。

例如企业资料、财务记录、合同、申报项目、AI 草稿等业务数据，不建议放入 IAM。IAM 只保留公司主数据摘要和授权范围：

```text
company_id
company_name
credit_code
user_id
app_code
relation_type
data_scope
```

## 3. 关键概念

### 3.1 app_code

`app_code` 表示一个接入系统或应用，例如：

```text
kjqb_admin
kjqb_client
policy_admin
finance_admin
crm_admin
service_center
```

当前项目原有的 `portal_type=admin/client` 不能继续承担“系统”含义。长期模型中：

```text
app_code: 哪个系统
portal_type: 哪类入口，比如 admin/client/mobile/openapi
```

### 3.2 client_id

`client_id` 是 OAuth/OIDC 客户端标识。一个 `app_code` 可以有多个 `client_id`：

```text
policy_admin_web
policy_admin_mobile
policy_admin_desktop
```

### 3.3 权限码

权限码建议保持业务可读、稳定、分层：

```text
模块:资源:动作
Enterprise:Profile:List
Enterprise:Profile:Edit
Policy:Project:Create
Finance:Invoice:Approve
System:User:List
```

权限码不要绑定页面路径。页面路径可以变，权限语义应长期稳定。

### 3.4 公司范围

公司范围解决“用户在某个系统里能访问哪些公司数据”。它独立于菜单权限。

示例：

```text
用户 A 在 policy_admin 中能访问公司 1、2，身份是 project_teacher。
用户 A 在 finance_admin 中能访问全部公司，身份是 finance_manager。
用户 B 在 kjqb_client 中只能访问自己绑定的公司。
```

## 4. 数据库表设计

以下为长期目标表结构。字段类型可按 MySQL 8/NestJS TypeORM 落地，时间字段统一包含 `created_at`、`updated_at`，必要表可加 `deleted_at` 做软删。

### 4.1 应用表 iam_app

```sql
CREATE TABLE iam_app (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  app_name VARCHAR(128) NOT NULL,
  app_type VARCHAR(32) NOT NULL DEFAULT 'web',
  portal_type VARCHAR(32) NOT NULL DEFAULT 'admin',
  home_path VARCHAR(255) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_app_code (app_code)
);
```

### 4.2 OAuth 客户端表 iam_oauth_client

```sql
CREATE TABLE iam_oauth_client (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  client_secret_hash VARCHAR(255) NULL,
  client_type VARCHAR(32) NOT NULL DEFAULT 'public',
  grant_types JSON NOT NULL,
  redirect_uris JSON NOT NULL,
  post_logout_redirect_uris JSON NULL,
  access_token_ttl INT NOT NULL DEFAULT 1800,
  refresh_token_ttl INT NOT NULL DEFAULT 2592000,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_oauth_client_id (client_id),
  KEY idx_iam_oauth_client_app (app_code)
);
```

说明：

- 浏览器 SPA 使用 `client_type=public`，必须走 PKCE，不发 `client_secret`。
- 服务端应用可使用 `client_type=confidential`，需要 `client_secret`。

### 4.3 用户表 iam_user

```sql
CREATE TABLE iam_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(64) NOT NULL,
  phone VARCHAR(32) NULL,
  email VARCHAR(128) NULL,
  avatar_path VARCHAR(500) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  password_changed_at DATETIME NULL,
  last_login_at DATETIME NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_user_username (username),
  UNIQUE KEY uk_iam_user_phone (phone),
  UNIQUE KEY uk_iam_user_email (email)
);
```

### 4.4 用户应用授权表 iam_user_app

```sql
CREATE TABLE iam_user_app (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  home_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_user_app (user_id, app_code),
  KEY idx_iam_user_app_code (app_code)
);
```

### 4.5 角色表 iam_role

```sql
CREATE TABLE iam_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  role_code VARCHAR(64) NOT NULL,
  role_name VARCHAR(64) NOT NULL,
  role_type VARCHAR(32) NOT NULL DEFAULT 'custom',
  status TINYINT NOT NULL DEFAULT 1,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_role_app_code (app_code, role_code),
  KEY idx_iam_role_app (app_code)
);
```

建议内置角色：

```text
super_admin
app_admin
project_teacher
enterprise_owner
enterprise_user
viewer
```

其中 `super_admin` 应限制在 IAM 管理后台，不建议让业务系统随意使用超级绕过逻辑。

### 4.6 权限表 iam_permission

```sql
CREATE TABLE iam_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  permission_code VARCHAR(128) NOT NULL,
  permission_name VARCHAR(128) NOT NULL,
  resource_type VARCHAR(32) NOT NULL DEFAULT 'api',
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_permission_app_code (app_code, permission_code),
  KEY idx_iam_permission_app (app_code)
);
```

`resource_type` 可选：

```text
menu
button
api
data
```

### 4.7 菜单表 iam_menu

```sql
CREATE TABLE iam_menu (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  app_code VARCHAR(64) NOT NULL,
  parent_id BIGINT NULL,
  name VARCHAR(128) NOT NULL,
  path VARCHAR(255) NOT NULL,
  component VARCHAR(255) NULL,
  redirect_path VARCHAR(255) NULL,
  menu_type VARCHAR(32) NOT NULL DEFAULT 'menu',
  icon VARCHAR(128) NULL,
  title VARCHAR(128) NOT NULL,
  order_num INT NOT NULL DEFAULT 0,
  auth_code VARCHAR(128) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_iam_menu_app_parent (app_code, parent_id),
  KEY idx_iam_menu_app_path (app_code, path)
);
```

`menu_type` 可选：

```text
catalog
menu
button
link
```

### 4.8 用户角色表 iam_user_role

```sql
CREATE TABLE iam_user_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  role_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_user_role (user_id, app_code, role_id),
  KEY idx_iam_user_role_user_app (user_id, app_code)
);
```

### 4.9 角色权限表 iam_role_permission

```sql
CREATE TABLE iam_role_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_role_permission (role_id, permission_id)
);
```

### 4.10 公司主数据表 iam_company

```sql
CREATE TABLE iam_company (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(128) NOT NULL,
  short_name VARCHAR(128) NULL,
  credit_code VARCHAR(64) NULL,
  legal_person VARCHAR(64) NULL,
  contact_name VARCHAR(64) NULL,
  contact_phone VARCHAR(32) NULL,
  province VARCHAR(64) NULL,
  city VARCHAR(64) NULL,
  district VARCHAR(64) NULL,
  status TINYINT NOT NULL DEFAULT 1,
  source_system VARCHAR(64) NULL,
  source_company_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_company_credit_code (credit_code),
  KEY idx_iam_company_name (company_name)
);
```

IAM 中只放公司主数据摘要。复杂企业资料仍留在业务系统。

### 4.11 用户公司范围表 iam_user_company_scope

```sql
CREATE TABLE iam_user_company_scope (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  company_id BIGINT NOT NULL,
  relation_type VARCHAR(32) NOT NULL,
  data_scope VARCHAR(32) NOT NULL DEFAULT 'assigned',
  is_default TINYINT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_user_company_scope (user_id, app_code, company_id, relation_type),
  KEY idx_iam_user_company_user_app (user_id, app_code),
  KEY idx_iam_user_company_company (company_id)
);
```

`relation_type` 建议：

```text
owner
employee
project_teacher
manager
viewer
```

`data_scope` 建议：

```text
all
assigned
self
readonly
```

### 4.12 授权码与会话表

授权码表：

```sql
CREATE TABLE iam_oauth_authorization_code (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code_hash VARCHAR(255) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  redirect_uri VARCHAR(500) NOT NULL,
  code_challenge VARCHAR(255) NOT NULL,
  code_challenge_method VARCHAR(16) NOT NULL,
  scopes JSON NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_auth_code_hash (code_hash)
);
```

刷新令牌表：

```sql
CREATE TABLE iam_refresh_token (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  token_hash VARCHAR(255) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  app_code VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  rotated_from_id BIGINT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_iam_refresh_token_hash (token_hash),
  KEY idx_iam_refresh_user_app (user_id, app_code)
);
```

SSO 会话表：

```sql
CREATE TABLE iam_sso_session (
  id VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  login_ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_iam_sso_session_user (user_id)
);
```

### 4.13 审计表

登录日志：

```sql
CREATE TABLE iam_login_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  username VARCHAR(64) NULL,
  app_code VARCHAR(64) NULL,
  client_id VARCHAR(128) NULL,
  result VARCHAR(32) NOT NULL,
  fail_reason VARCHAR(255) NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_iam_login_log_user (user_id),
  KEY idx_iam_login_log_app (app_code)
);
```

授权变更日志：

```sql
CREATE TABLE iam_access_audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  operator_user_id BIGINT NULL,
  target_user_id BIGINT NULL,
  app_code VARCHAR(64) NULL,
  action VARCHAR(64) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_iam_access_audit_target (target_user_id),
  KEY idx_iam_access_audit_app (app_code)
);
```

## 5. Token 结构

### 5.1 accessToken

`accessToken` 使用 JWT，建议 RS256/ES256 非对称签名。业务系统通过 IAM 的 JWKS 公钥本地验签。

建议有效期：15 到 30 分钟。

示例 payload：

```json
{
  "iss": "https://iam.example.com",
  "sub": "10001",
  "aud": "policy_admin",
  "azp": "policy_admin_web",
  "jti": "01HZX...",
  "sid": "sso-session-id",
  "iat": 1760000000,
  "exp": 1760001800,
  "user": {
    "id": "10001",
    "username": "zhangsan",
    "realName": "张三",
    "phone": "13800000000"
  },
  "app": {
    "appCode": "policy_admin",
    "portalType": "admin"
  },
  "roles": ["project_teacher"],
  "permissions": [
    "Enterprise:Profile:List",
    "Policy:Project:Edit"
  ],
  "scopeVersion": 12
}
```

### 5.2 refreshToken

`refreshToken` 不建议使用可解析 JWT，建议使用高强度随机字符串，服务端只保存 hash。

要求：

- 刷新时轮换 refreshToken。
- 旧 refreshToken 立即失效。
- 检测重复使用时可撤销同一 session 下所有 refreshToken。
- 按 `client_id + user_id + session_id` 管理。

### 5.3 idToken

如果兼容 OIDC，可返回 `idToken` 给前端识别登录用户。业务接口仍应使用 `accessToken`。

示例字段：

```json
{
  "iss": "https://iam.example.com",
  "sub": "10001",
  "aud": "policy_admin_web",
  "iat": 1760000000,
  "exp": 1760001800,
  "name": "张三",
  "preferred_username": "zhangsan",
  "phone_number": "13800000000"
}
```

### 5.4 权限变更生效策略

第一期建议：

- accessToken 短有效期。
- 权限变更后最多 15 到 30 分钟自然生效。
- 高风险场景可提升 `scopeVersion`，业务系统发现版本过旧时拒绝并要求刷新。

第二期可增加：

- Token 黑名单。
- 用户强制下线。
- 应用级权限缓存主动失效。

## 6. 接口清单

### 6.1 标准认证接口

```text
GET  /oauth/authorize
POST /oauth/token
POST /oauth/revoke
POST /oauth/introspect
GET  /oauth/userinfo
GET  /.well-known/openid-configuration
GET  /.well-known/jwks.json
POST /auth/logout
GET  /auth/session
```

#### GET /oauth/authorize

请求参数：

```text
response_type=code
client_id=policy_admin_web
redirect_uri=https://policy.example.com/auth/callback
scope=openid profile permissions
state=random-state
code_challenge=pkce-challenge
code_challenge_method=S256
```

未登录时展示 IAM 登录页；已登录时校验用户是否有该 app 访问权，然后签发授权码并回跳。

#### POST /oauth/token

授权码换 Token：

```json
{
  "grant_type": "authorization_code",
  "client_id": "policy_admin_web",
  "code": "xxx",
  "redirect_uri": "https://policy.example.com/auth/callback",
  "code_verifier": "xxx"
}
```

刷新 Token：

```json
{
  "grant_type": "refresh_token",
  "client_id": "policy_admin_web",
  "refresh_token": "xxx"
}
```

返回：

```json
{
  "access_token": "jwt",
  "refresh_token": "opaque-token",
  "id_token": "jwt",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### 6.2 当前用户接口

```text
GET /iam/me
GET /iam/me/apps
GET /iam/me/apps/{appCode}/permissions
GET /iam/me/apps/{appCode}/menus
GET /iam/me/apps/{appCode}/companies
GET /iam/me/apps/{appCode}/companies/current
PUT /iam/me/apps/{appCode}/companies/current
```

#### GET /iam/me

返回当前用户基础信息：

```json
{
  "id": "10001",
  "username": "zhangsan",
  "realName": "张三",
  "phone": "13800000000",
  "email": null,
  "avatar": null
}
```

#### GET /iam/me/apps/{appCode}/permissions

返回当前用户在指定应用下的权限码。

```json
[
  "Enterprise:Profile:List",
  "Enterprise:Profile:Edit"
]
```

#### GET /iam/me/apps/{appCode}/menus

返回已按权限过滤的菜单树。

```json
[
  {
    "id": "1",
    "name": "enterprise",
    "path": "/enterprise",
    "component": null,
    "redirect": "/enterprise/profile",
    "type": "catalog",
    "authCode": "Enterprise:Profile:List",
    "meta": {
      "title": "企业管理",
      "icon": "mdi:domain",
      "order": 1
    },
    "children": []
  }
]
```

#### GET /iam/me/apps/{appCode}/companies

返回当前用户可访问公司列表。

```json
[
  {
    "id": "20001",
    "name": "某某科技有限公司",
    "shortName": "某某科技",
    "creditCode": "913...",
    "relationType": "project_teacher",
    "dataScope": "assigned",
    "isDefault": true
  }
]
```

### 6.3 IAM 管理接口

应用管理：

```text
GET    /iam/admin/apps
POST   /iam/admin/apps
GET    /iam/admin/apps/{appCode}
PUT    /iam/admin/apps/{appCode}
DELETE /iam/admin/apps/{appCode}
```

OAuth 客户端：

```text
GET  /iam/admin/apps/{appCode}/clients
POST /iam/admin/apps/{appCode}/clients
PUT  /iam/admin/apps/{appCode}/clients/{clientId}
```

用户管理：

```text
GET    /iam/admin/users
POST   /iam/admin/users
GET    /iam/admin/users/{userId}
PUT    /iam/admin/users/{userId}
POST   /iam/admin/users/{userId}/reset-password
POST   /iam/admin/users/{userId}/disable
POST   /iam/admin/users/{userId}/enable
```

用户应用授权：

```text
GET  /iam/admin/users/{userId}/apps
PUT  /iam/admin/users/{userId}/apps
```

角色管理：

```text
GET    /iam/admin/apps/{appCode}/roles
POST   /iam/admin/apps/{appCode}/roles
GET    /iam/admin/apps/{appCode}/roles/{roleId}
PUT    /iam/admin/apps/{appCode}/roles/{roleId}
DELETE /iam/admin/apps/{appCode}/roles/{roleId}
PUT    /iam/admin/apps/{appCode}/roles/{roleId}/permissions
```

权限码管理：

```text
GET  /iam/admin/apps/{appCode}/permissions
POST /iam/admin/apps/{appCode}/permissions
PUT  /iam/admin/apps/{appCode}/permissions/{permissionId}
```

菜单管理：

```text
GET    /iam/admin/apps/{appCode}/menus
POST   /iam/admin/apps/{appCode}/menus
PUT    /iam/admin/apps/{appCode}/menus/{menuId}
DELETE /iam/admin/apps/{appCode}/menus/{menuId}
```

用户角色：

```text
GET /iam/admin/users/{userId}/apps/{appCode}/roles
PUT /iam/admin/users/{userId}/apps/{appCode}/roles
```

公司授权：

```text
GET    /iam/admin/companies
POST   /iam/admin/companies
PUT    /iam/admin/companies/{companyId}
GET    /iam/admin/users/{userId}/apps/{appCode}/companies
PUT    /iam/admin/users/{userId}/apps/{appCode}/companies
DELETE /iam/admin/users/{userId}/apps/{appCode}/companies/{companyId}
```

审计：

```text
GET /iam/admin/audit/login-logs
GET /iam/admin/audit/access-logs
```

## 7. 前端登录流程

### 7.1 业务前端配置

每个业务前端配置：

```text
VITE_APP_CODE=policy_admin
VITE_IAM_ISSUER=https://iam.example.com
VITE_IAM_CLIENT_ID=policy_admin_web
VITE_IAM_REDIRECT_URI=https://policy.example.com/auth/callback
VITE_IAM_POST_LOGOUT_REDIRECT_URI=https://policy.example.com/login
```

### 7.2 首次访问流程

```text
1. 用户访问业务系统页面。
2. 前端检查本地是否有 accessToken。
3. 没有 token 时生成 state、code_verifier、code_challenge。
4. 跳转到 IAM /oauth/authorize。
5. IAM 登录成功并校验用户有 appCode 访问权。
6. IAM 带 code 和 state 回跳业务系统 /auth/callback。
7. 前端校验 state。
8. 前端调用 /oauth/token，用 code + code_verifier 换 token。
9. 保存 accessToken；refreshToken 建议由 IAM 设置 HttpOnly Cookie，或按部署情况安全保存。
10. 调 /iam/me、/iam/me/apps/{appCode}/permissions、/menus、/companies。
11. 生成动态路由、设置按钮权限、进入 homePath 或 redirect。
```

### 7.3 刷新流程

```text
1. 业务请求返回 401 或 accessToken 即将过期。
2. 前端调用 /oauth/token grant_type=refresh_token。
3. IAM 轮换 refreshToken 并返回新的 accessToken。
4. 原业务请求重试一次。
5. 刷新失败则清理本地状态并跳 IAM 登录。
```

### 7.4 退出流程

```text
1. 前端调用 IAM /auth/logout 或 /oauth/revoke。
2. IAM 撤销 SSO session 和 refreshToken。
3. 前端清理本地 accessToken、权限码、菜单、公司上下文。
4. 跳转 post_logout_redirect_uri。
```

### 7.5 菜单与按钮控制

前端不再硬编码可见菜单。前端只维护组件映射：

```ts
const componentMap = {
  'enterprise/profile/list': () => import('@/views/enterprise/profile/list.vue'),
};
```

IAM 返回菜单树，前端按 `component` 字段映射组件。按钮使用权限码判断：

```ts
accessStore.hasAccessByCodes(['Enterprise:Profile:Edit']);
```

## 8. 后端 Guard 规范

### 8.1 业务后端配置

每个业务后端配置：

```text
APP_CODE=policy_admin
IAM_ISSUER=https://iam.example.com
IAM_JWKS_URL=https://iam.example.com/.well-known/jwks.json
IAM_AUDIENCE=policy_admin
IAM_PERMISSION_CACHE_TTL=300
```

### 8.2 IamAuthGuard

职责：

- 从 `Authorization: Bearer <token>` 读取 token。
- 使用 IAM JWKS 公钥验签。
- 校验 `iss`、`aud`、`exp`、`nbf`。
- 校验 token 中 `app.appCode` 与当前服务 `APP_CODE` 一致。
- 将用户上下文写入 `request.currentUser`。

推荐上下文结构：

```ts
export interface IamCurrentUser {
  id: string;
  username: string;
  realName: string;
  appCode: string;
  portalType?: string;
  roles: string[];
  permissions: string[];
  scopeVersion?: number;
}
```

### 8.3 IamPermissionGuard

接口装饰器：

```ts
@RequirePermission('Enterprise:Profile:Edit')
```

校验规则：

- 当前用户必须存在。
- 当前用户 `permissions` 必须包含要求权限码。
- 多个权限默认全部满足；需要任一满足时提供 `mode: any`。
- `super_admin` 仅在 IAM 管理后台默认放行；业务系统是否放行应显式配置。

建议装饰器：

```ts
@RequirePermissions(['A:B:C', 'A:B:D'], { mode: 'all' })
@RequirePermissions(['A:B:C', 'A:B:D'], { mode: 'any' })
@RequireRoles(['app_admin'])
```

### 8.4 IamCompanyScopeGuard

接口装饰器：

```ts
@RequireCompanyScope({ param: 'enterpriseId' })
@RequireCompanyScope({ body: 'companyId' })
@RequireCompanyScope({ query: 'enterpriseId' })
```

校验规则：

- 从参数、body 或 query 中读取公司 ID。
- 读取当前用户在当前 `appCode` 下的公司范围。
- 如果用户具有 `data_scope=all`，放行。
- 否则公司 ID 必须在 `iam_user_company_scope` 授权范围内。
- 对写操作可要求 relationType 或 dataScope 满足更高等级。

建议支持：

```ts
@RequireCompanyScope({ param: 'enterpriseId', action: 'read' })
@RequireCompanyScope({ param: 'enterpriseId', action: 'write' })
```

### 8.5 服务间调用

服务间调用不要使用普通用户 token。建议使用 `client_credentials` 或内部服务 token。

```text
POST /oauth/token
{
  "grant_type": "client_credentials",
  "client_id": "policy_service",
  "client_secret": "***",
  "scope": "iam.company.read"
}
```

内部服务 token 应限制 scopes、来源 IP 和有效期。

## 9. 其他服务接入规范

每个系统接入 IAM 时需要完成：

1. 在 IAM 注册应用 `app_code`。
2. 创建 OAuth Client，配置 redirect URI 和 logout URI。
3. 导入系统菜单和权限码。
4. 配置系统角色。
5. 给用户分配应用访问权和角色。
6. 如涉及公司数据，配置用户公司范围。
7. 前端接入 OAuth + PKCE 登录流程。
8. 后端接入 JWT 验签、权限 Guard、公司范围 Guard。
9. 移除本系统内重复的登录、用户、角色、菜单维护入口。

推荐提供一个接入清单模板：

```text
系统名称：
app_code：
前端地址：
后端地址：
client_id：
redirect_uri：
post_logout_redirect_uri：
默认 home_path：
是否需要公司范围：是/否
首批角色：
首批权限码：
首批菜单：
```

## 10. 当前系统迁移步骤

当前系统已有 `sys_user/sys_role/sys_permission/sys_menu`、`portal_type`、企业负责人、企业用户、项目老师等数据。建议以当前系统作为第一个 IAM 接入方，分阶段迁移。

### 10.1 阶段一：冻结模型与映射

确定当前系统拆成两个应用：

```text
kjqb_admin: 当前后台管理系统
kjqb_client: 当前客户端系统
```

建立映射：

```text
sys_user -> iam_user
sys_role(portal_type=admin) -> iam_role(app_code=kjqb_admin)
sys_role(portal_type=client) -> iam_role(app_code=kjqb_client)
sys_permission(portal_type=admin) -> iam_permission(app_code=kjqb_admin)
sys_permission(portal_type=client) -> iam_permission(app_code=kjqb_client)
sys_menu(portal_type=admin) -> iam_menu(app_code=kjqb_admin)
sys_menu(portal_type=client) -> iam_menu(app_code=kjqb_client)
sys_user_role -> iam_user_role，按 role.portal_type 映射 app_code
biz_enterprise -> iam_company
biz_enterprise_owner -> iam_user_company_scope(relation_type=owner)
biz_enterprise_user -> iam_user_company_scope(relation_type=employee)
biz_enterprise_teacher -> iam_user_company_scope(relation_type=project_teacher)
```

### 10.2 阶段二：搭建 IAM 服务

先实现最小闭环：

- `iam_user`
- `iam_app`
- `iam_oauth_client`
- `iam_role`
- `iam_permission`
- `iam_menu`
- `iam_user_role`
- `iam_role_permission`
- `iam_company`
- `iam_user_company_scope`
- `/oauth/authorize`
- `/oauth/token`
- `/iam/me`
- `/iam/me/apps/{appCode}/menus`
- `/iam/me/apps/{appCode}/permissions`
- `/iam/me/apps/{appCode}/companies`
- `/.well-known/jwks.json`

### 10.3 阶段三：数据迁移

编写一次性迁移脚本：

1. 迁移用户，保持原用户 ID 或记录原系统 ID 映射。
2. 迁移角色、权限、菜单。
3. 迁移用户角色绑定。
4. 迁移公司主数据摘要。
5. 迁移用户公司范围。
6. 对比迁移前后用户权限码数量和菜单数量。
7. 对典型账号做登录、菜单、公司列表验证。

### 10.4 阶段四：当前前端接入 SSO

当前 `vue-admin/apps/web-admin`、`vue-admin/apps/web-client` 调整为：

- 使用 `VITE_APP_CODE` 替代仅靠 `VITE_APP_PORTAL`。
- 登录页跳 IAM `/oauth/authorize`。
- 新增 `/auth/callback` 页面处理授权码。
- 登录后从 IAM 获取用户、权限、菜单、公司上下文。
- 原 `/auth/login`、`/auth/refresh`、`/auth/codes` 调用改为 IAM 接口。

### 10.5 阶段五：当前后端接入 IAM Guard

当前 `backend` 调整为业务服务：

- 保留业务接口。
- 移除或废弃本地登录接口。
- `AccessTokenGuard` 替换为 `IamAuthGuard`。
- `PermissionGuard` 改为读取 IAM JWT 权限码。
- 企业相关接口统一接入 `IamCompanyScopeGuard`。
- 本地 `sys_user/sys_role/sys_permission/sys_menu` 进入只读兼容期，最终下线。

### 10.6 阶段六：双跑与切换

建议双跑一段时间：

```text
本地鉴权仍可用，但新登录入口走 IAM。
权限、菜单以 IAM 为准。
发现问题可快速切回本地登录。
```

双跑验证项：

- admin 用户菜单是否一致。
- project_teacher 是否只能访问绑定企业。
- enterprise_owner 是否只能访问自己的企业。
- enterprise_user 默认公司切换是否正常。
- 权限变更后是否在预期时间内生效。
- 登出后 refreshToken 是否失效。

### 10.7 阶段七：下线本地身份权限

稳定后：

- 当前系统停止维护本地用户、角色、权限、菜单。
- 本地相关表只保留迁移备份或删除。
- 所有新系统只接 IAM。

## 11. 实施里程碑

### M1：详细设计与基础骨架

产出：

- IAM 数据库 migration。
- NestJS IAM 服务骨架。
- OAuth Client 注册能力。
- JWKS 签名密钥管理。

验收：

- 能创建 app、client、user。
- 能签发可验签的 accessToken。

### M2：登录与 Token 闭环

产出：

- `/oauth/authorize`
- `/oauth/token`
- `/auth/logout`
- refreshToken 轮换
- 登录日志

验收：

- 前端可跳转 IAM 登录并回调。
- accessToken 可被业务后端验签。

### M3：角色权限菜单闭环

产出：

- 角色、权限、菜单管理接口。
- 当前用户权限码接口。
- 当前用户菜单接口。

验收：

- 不同角色获取不同菜单。
- 按钮权限码可被前端识别。
- 后端接口可通过 `@RequirePermission` 校验。

### M4：公司范围闭环

产出：

- 公司主数据表。
- 用户公司范围管理。
- 当前用户公司列表。
- 公司范围 Guard。

验收：

- 用户只能访问授权公司。
- 默认公司切换正常。
- 项目老师/企业负责人/企业用户身份可迁移。

### M5：当前系统迁移

产出：

- 迁移脚本。
- 当前后台接 IAM。
- 当前客户端接 IAM。
- 当前业务后端接 IAM Guard。

验收：

- 当前系统主流程可用。
- 权限、菜单、公司范围和迁移前一致或按新规则明确变更。

### M6：其他系统接入

产出：

- 前端 SDK。
- 后端 SDK。
- 接入文档。
- 系统接入清单模板。

验收：

- 第二个系统按模板接入。
- 不需要复制登录、用户、角色、菜单代码。

## 12. 风险与处理

### 12.1 权限迁移不一致

处理：迁移后做对账脚本，按用户输出旧权限码、新权限码、差异权限码。

### 12.2 公司范围遗漏

处理：企业数据接口必须接 `IamCompanyScopeGuard`，对缺少 companyId 的列表接口要先从用户范围反查可访问 companyIds。

### 12.3 Token 过大

如果权限码太多，JWT 会变大。第一期可以先放权限码；后续可改为只放 `scopeVersion`，业务系统从 IAM 拉权限并缓存。

### 12.4 统一登出不彻底

第一期保证 refreshToken 撤销和前端本地清理。后续再做前通道/后通道登出通知。

### 12.5 IAM 单点故障

业务系统本地验签 accessToken，IAM 短时不可用不影响已登录用户访问。但登录、刷新、权限变更会受影响。生产部署应做多实例、数据库备份、密钥轮换预案。

## 13. 第一版最小可落地范围

第一版不要一次做完所有治理能力。建议最小范围：

- OAuth 授权码 + PKCE 登录。
- JWT accessToken + refreshToken 轮换。
- 用户、应用、角色、权限、菜单。
- 用户公司范围。
- 当前系统 admin/client 接入。
- 后端 Auth/Permission/CompanyScope Guard。
- 前端 callback、菜单、权限码、公司上下文。

暂缓到第二期：

- MFA。
- 权限审批流。
- 复杂组织继承权限。
- 第三方企业微信/钉钉登录。
- 细粒度字段级权限。
- 完整 OIDC 认证认证声明扩展。

## 14. 下一步建议

1. 先确认第一批接入系统的 `app_code` 命名。
2. 确认 IAM 独立部署方式：新 NestJS 服务，单独数据库，还是先同库不同 schema。
3. 根据本文拆出实施计划和 migration 计划。
4. 先做 M1-M2，打通一个最小 SSO 登录闭环。
5. 再迁移当前系统权限和菜单，最后接其他系统。
