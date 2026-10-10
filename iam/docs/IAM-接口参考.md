# IAM/SSO 接口参考

基础地址：`https://iam.example.com`。本地开发为 `http://127.0.0.1:3101`。

除 OAuth 及发现接口外，所有需要认证的接口都使用：

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

`/iam/admin/*` 仅允许启用的 `iam_admin/super_admin` 用户访问。业务系统运行期只能使用“用户上下文接口”，不应调用管理员接口。

## 1. OAuth 与 SSO

| 方法 | 路径 | 用途 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/oauth/session` | 使用用户名密码创建 IAM SSO 会话 | 无 |
| `GET` | `/oauth/authorize` | Authorization Code + PKCE 授权 | SSO Cookie |
| `POST` | `/oauth/token` | 兑换授权码或刷新令牌 | Client 参数 |
| `POST` | `/oauth/revoke` | 撤销刷新令牌 | Client 参数 |
| `POST` | `/oauth/logout` | 统一登出并撤销 SSO 会话 | SSO Cookie |
| `GET` | `/oauth/userinfo` | 查询令牌对应用户 | Bearer Token |
| `GET` | `/.well-known/jwks.json` | RS256 公钥集合 | 无 |
| `GET` | `/.well-known/openid-configuration` | OIDC 发现文档 | 无 |

### 创建 SSO 会话

`POST /oauth/session`

```json
{ "username": "alice", "password": "StrongPassword1!" }
```

响应 `201` 并写入 `HttpOnly` Cookie `iam_sso_session`：

```json
{
  "expiresAt": "2026-07-15T12:00:00.000Z",
  "user": { "username": "alice", "realName": "Alice" }
}
```

### 发起授权

`GET /oauth/authorize`

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `response_type` | 是 | 固定 `code` |
| `client_id` | 是 | OAuth Client ID |
| `redirect_uri` | 是 | 必须精确匹配已登记地址 |
| `code_challenge` | 是 | PKCE S256 challenge |
| `code_challenge_method` | 是 | 固定 `S256` |
| `state` | 建议 | 前端防 CSRF 状态值 |
| `scope` | 否 | 建议 `openid profile permissions` |

成功后 `302` 到：

```text
https://project.example.com/auth/callback?code=<authorization_code>&state=<state>
```

没有 SSO Cookie 时，IAM 重定向到统一登录页；用户完成登录后继续原授权请求。

### 交换授权码

`POST /oauth/token`

```json
{
  "grant_type": "authorization_code",
  "client_id": "project_center_web",
  "code": "authorization-code",
  "code_verifier": "original-pkce-verifier",
  "redirect_uri": "https://project.example.com/auth/callback"
}
```

机密 Client 还需要传 `client_secret`。响应：

```json
{
  "access_token": "eyJ...",
  "id_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### 刷新与撤销

刷新：

```json
{
  "grant_type": "refresh_token",
  "client_id": "project_center_web",
  "refresh_token": "previous-refresh-token"
}
```

每次刷新返回新的 refresh token，旧 token 立即失效。撤销：

```json
{ "client_id": "project_center_web", "token": "refresh-token" }
```

## 2. JWT 结构与验证

访问令牌为 RS256 JWT，业务后端必须使用 JWKS 验签。典型 claims：

```json
{
  "iss": "https://iam.example.com",
  "sub": "iam-user-id",
  "aud": "project_center_web",
  "app_code": "project_center",
  "preferred_username": "alice",
  "name": "Alice",
  "source_user_id": "42",
  "roles": ["project_manager"],
  "permissions": ["Project:Read", "Project:Create"],
  "home_path": "/projects",
  "iat": 0,
  "exp": 0
}
```

必须验证：`alg=RS256`、签名、`kid`、`iss`、`aud`、`app_code`、`exp` 与可选 `nbf`。禁止信任前端传递的用户 ID、角色、权限或公司 ID。

## 3. 业务运行期用户上下文接口

| 方法 | 路径 | 返回 |
| --- | --- | --- |
| `GET` | `/iam/me` | 当前用户基础信息 |
| `GET` | `/iam/me/apps/:appCode/permissions` | 当前应用权限码数组 |
| `GET` | `/iam/me/apps/:appCode/menus` | 当前应用菜单树 |
| `GET` | `/iam/me/apps/:appCode/companies` | 当前应用公司访问范围 |
| `PUT` | `/iam/me/apps/:appCode/companies/:companyId/default` | 切换并返回公司范围 |

`GET /iam/me` 示例：

```json
{
  "id": "12",
  "username": "alice",
  "realName": "Alice",
  "phone": null,
  "email": "alice@example.com",
  "avatar": null
}
```

`GET /iam/me/apps/project_center/permissions`：

```json
["Project:Read", "Project:Create"]
```

`GET /iam/me/apps/project_center/menus`：

```json
[
  {
    "id": "101",
    "name": "项目管理",
    "path": "/projects",
    "type": "menu",
    "component": "projects/index",
    "authCode": "Project:Read",
    "status": 1,
    "meta": { "title": "项目管理", "order": 10 },
    "children": []
  }
]
```

`GET /iam/me/apps/project_center/companies`：

```json
[
  {
    "id": "301",
    "companyName": "示例科技有限公司",
    "sourceCompanyId": "10001",
    "sourceSystem": "project_center_db",
    "dataScope": "assigned",
    "relationType": "owner",
    "isDefault": true
  }
]
```

`companyId` 参数使用 IAM 公司索引 ID（上述 `id`），业务数据过滤使用 `sourceCompanyId`。

## 4. IAM 管理接口

以下接口用于 IAM 管理端、受控后台任务或同步服务。所有接口前缀为 `/iam/admin`，均需要 IAM 管理员令牌。

### 应用、用户与应用访问

| 方法 | 路径 | 请求体核心字段 |
| --- | --- | --- |
| `GET` | `/apps` | - |
| `POST` | `/apps` | `appCode`, `appName`, `portalType`, `homePath`, `companySourceSystem`, `status` |
| `PUT` | `/apps/:id` | 同创建，`appCode` 不应变更 |
| `GET` | `/users` | - |
| `POST` | `/users` | `username`, `realName`, `password`, `phone`, `email`, `status` |
| `PUT` | `/users/:id` | 同用户字段，`password` 可选 |
| `GET` | `/users/:id/apps` | - |
| `PUT` | `/users/:id/apps/:appCode` | `homePath`, `status` |
| `GET` | `/users/:id/apps/:appCode/roles` | - |
| `PUT` | `/users/:id/apps/:appCode/roles` | `{ "roleIds": ["..."] }` |

创建应用示例：

```json
{
  "appCode": "project_center",
  "appName": "项目中心",
  "appType": "web",
  "portalType": "admin",
  "homePath": "/projects",
  "companySourceSystem": "project_center_db",
  "status": 1
}
```

### OAuth Client

| 方法 | 路径 | 请求体核心字段 |
| --- | --- | --- |
| `GET` | `/apps/:appCode/clients` | - |
| `POST` | `/apps/:appCode/clients` | `clientId`, `clientType`, `grantTypes`, `redirectUris` |
| `PUT` | `/apps/:appCode/clients/:clientId` | 同创建，可设置 TTL、状态、Secret |

示例：

```json
{
  "clientId": "project_center_web",
  "clientType": "public",
  "grantTypes": ["authorization_code", "refresh_token"],
  "redirectUris": ["https://project.example.com/auth/callback"],
  "postLogoutRedirectUris": ["https://project.example.com/login"],
  "accessTokenTtl": 1800,
  "refreshTokenTtl": 2592000,
  "status": 1
}
```

### 角色、权限与菜单

| 方法 | 路径 | 请求体核心字段 |
| --- | --- | --- |
| `GET/POST` | `/apps/:appCode/roles` | `roleCode`, `roleName`, `roleType`, `status` |
| `PUT` | `/apps/:appCode/roles/:roleId` | 同角色字段 |
| `GET/PUT` | `/apps/:appCode/roles/:roleId/permissions` | `PUT: { "permissionIds": [] }` |
| `GET/POST` | `/apps/:appCode/permissions` | `permissionCode`, `permissionName`, `resourceType`, `status` |
| `PUT` | `/apps/:appCode/permissions/:permissionId` | 同权限字段 |
| `GET/POST` | `/apps/:appCode/menus` | `menuName`, `menuType`, `path`, `component`, `authCode`, `parentId` |
| `PUT` | `/apps/:appCode/menus/:menuId` | 同菜单字段 |

### 公司授权与平台组织

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/companies` | 查询业务系统同步的公司索引 |
| `POST/PUT` | `/companies`、`/companies/:id` | 仅同步任务维护公司索引 |
| `GET` | `/companies/:id/members?appCode=:appCode` | 查询应用内公司授权 |
| `PUT` | `/companies/:id/members` | 设置负责人/成员、范围与默认公司 |
| `GET/POST` | `/platform-departments` | 查询/创建平台部门 |
| `PUT` | `/platform-departments/:id` | 更新平台部门 |
| `GET/PUT` | `/platform-departments/:id/members` | 查询/设置部门成员 |

公司授权请求：

```json
{
  "appCode": "project_center",
  "userId": "12",
  "memberType": "owner",
  "dataScope": "assigned",
  "isPrimary": true,
  "isDefault": true,
  "status": 1
}
```

`memberType` 只能是 `owner`、`employee`、`project_teacher`；`dataScope` 只能是 `assigned`、`all`。

平台部门请求：

```json
{
  "deptCode": "product",
  "deptName": "产品部",
  "parentId": null,
  "leaderUserId": "12",
  "sortOrder": 10,
  "status": 1,
  "remark": "平台内部组织"
}
```

### 管理员会话与审计

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/auth/login` | IAM 管理端账号密码登录 |
| `GET` | `/auth/codes` | 当前管理员权限码 |
| `POST` | `/auth/logout` | 管理端登出 |
| `GET` | `/audit/events` | 审计查询，支持 `page`、`limit`、`username`、`action`、`outcome`、`startAt`、`endAt` |

## 5. 状态码与错误处理

| 状态码 | 业务系统处理 |
| --- | --- |
| `400` | 请求参数、PKCE、Client 或回调地址不合法；记录错误并修正配置 |
| `401` | access token 不存在、过期或无效；前端刷新一次，失败后登录 |
| `403` | 已认证但无角色、权限或公司范围；展示无权访问，不重试 |
| `404` | URL 或资源不存在；检查 appCode、资源 ID、接口版本 |
| `429` | 登录请求被限流；提示稍后再试 |
| `5xx` | IAM 或网络异常；公司数据接口必须失败关闭，拒绝数据访问 |
