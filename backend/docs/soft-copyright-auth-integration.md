# 软件著作权管理系统统一认证接入文档

## 1. 文档目的

本文说明软件著作权管理系统如何接入当前 `new_kjqb` 后端提供的统一用户、角色、权限和认证能力。文中的系统编码、管理员和回调地址已经登记到当前数据库。

| 项目 | 当前值 |
| --- | --- |
| 应用编码 | `soft-copyright` |
| 应用名称 | 软件著作权管理系统 |
| 默认 Portal | `admin` |
| 初始管理员 | `admin` |
| 初始角色 | `admin`（仅属于 `soft-copyright`） |
| Browser Client ID | `soft-copyright-web` |
| Client 类型 | `public` |
| 已登记回调地址 | `https://soft.example.com/auth/callback` |

## 2. 当前能力边界

### 已实现

- 统一账号登录、刷新、退出和当前用户资料读取。
- 以 `appCode` 隔离用户应用授权、角色、权限、菜单和 refresh Cookie。
- Redis SessionStore，可用于多后端实例共享会话。
- RS256 JWT 签发、验签和 JWKS 公钥发布。
- 软件著作权系统的应用记录、`admin` 用户授权、应用内管理员角色和 Browser Client 记录。
- 认证资料接口可读取跨应用 Token：`/auth/userinfo`、`/auth/codes`。

### 尚未实现

- OAuth 2.0 / OIDC 授权码端点，例如 `/authorize`、`/token`。
- 浏览器跳转式 SSO 登录页和回调 code 交换。
- 软件著作权系统自身的业务菜单、权限码、普通角色和用户分配 UI。
- Token 中的实时权限版本校验或权限变更推送。

因此，当前可采用“软著前端直接调用认证中心登录接口”的方式接入。`sys_app_client` 的记录已经准备好，但不能把它当作已可用的 OAuth 授权码流程。

## 3. 总体架构

```mermaid
flowchart LR
  Browser["软著系统前端\nsoft.example.com"] -->|"CORS + HTTPS"| Auth["统一认证后端\nnew_kjqb"]
  Auth -->|"sys_app / sys_user_app"| DB[("MySQL")]
  Auth -->|"Redis Session\n启用后"| Redis[("Redis")]
  Browser -->|"Bearer accessToken"| SoftApi["软著业务后端"]
  SoftApi -->|"读取 JWKS 并验签 RS256 JWT"| Auth
```

认证中心负责身份、应用授权和 refresh Session；软著业务后端负责软著业务数据与本系统权限判定。不要让软著系统直接读写 KJQB 的业务表、角色、菜单或权限记录。

## 4. 上线前配置

### 4.1 认证中心环境变量

在认证中心后端的 `.env` 中配置生产 Redis、JWT 密钥和软著前端 CORS 来源。示例中的密码和密钥必须替换为生产值，不能提交到 Git。

```env
CORS_ORIGINS=https://soft.example.com,https://现有KJQB前端域名

REDIS_ENABLED=true
REDIS_URL=redis://:替换为强随机密码@127.0.0.1:6379/0
REDIS_KEY_PREFIX=hqx:auth:
AUTH_SESSION_STORE=redis

AUTH_TOKEN_MODE=dual
AUTH_JWT_ISSUER=hqx-auth
AUTH_JWT_KEY_ID=hqx-auth-2026-01
AUTH_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
AUTH_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
```

说明：

- `legacy`：随机 accessToken + Session，保持旧行为。
- `dual`：允许仍有效的旧随机 Token；新的 Redis Session 签发 RS256 JWT。建议作为迁移阶段。
- `jwt`：仅接受 JWT。确认所有接入方完成迁移后再切换。
- `jwt` 和 `dual` 都要求 `AUTH_SESSION_STORE=redis`、`REDIS_ENABLED=true`、私钥和公钥同时存在；配置错误时后端会拒绝启动。
- 启用 Redis Session 会让现有进程内存会话在重启后失效，需安排用户重新登录窗口。

### 4.2 生成 RS256 密钥

在安全的运维环境中生成，私钥只保存于认证中心：

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out auth-private.pem
openssl pkey -in auth-private.pem -pubout -out auth-public.pem
```

将 PEM 内容写入密钥管理系统或环境变量。环境变量中的换行使用 `\n` 表示。密钥轮换时使用新的 `AUTH_JWT_KEY_ID`，保留旧公钥直到旧 accessToken 全部过期。

### 4.3 Redis 部署与健康检查

```powershell
$env:REDIS_PASSWORD = '替换为强随机密码'
docker compose -f deploy/redis/docker-compose.yml up -d
```

认证中心启动后检查：

```text
GET /health/redis
```

返回 `{"status":"ok"}` 后才能设置 `AUTH_SESSION_STORE=redis` 并重启服务。

## 5. 软著系统前端接入

以下示例假设认证中心地址为 `https://auth.example.com`。实际部署时替换为认证中心真实地址。

### 5.1 登录

```http
POST https://auth.example.com/auth/login
Content-Type: application/json
Origin: https://soft.example.com

{
  "username": "admin",
  "password": "<password>",
  "portal": "admin",
  "appCode": "soft-copyright"
}
```

成功响应：

```json
{
  "accessToken": "eyJ..."
}
```

认证中心同时写入 HttpOnly refresh Cookie：

```text
auth_soft-copyright_admin_refresh_token
```

前端请求必须携带凭据：

```ts
await fetch('https://auth.example.com/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username,
    password,
    portal: 'admin',
    appCode: 'soft-copyright',
  }),
});
```

accessToken 只保存在运行时内存或受控状态容器；不要放入 URL、localStorage 或日志。

### 5.2 获取当前用户与权限

```http
GET https://auth.example.com/auth/userinfo
Authorization: Bearer <accessToken>
```

响应包含当前应用身份，例如：

```json
{
  "appCode": "soft-copyright",
  "id": 1,
  "portal": "admin",
  "username": "admin",
  "realName": "管理员",
  "roles": ["admin"],
  "permissions": []
}
```

读取最新权限码：

```http
GET https://auth.example.com/auth/codes
Authorization: Bearer <accessToken>
```

初始管理员角色没有软著系统菜单和权限，因此当前返回空数组是预期状态。软著业务系统应先定义自己的权限码，再把权限绑定给应用内角色。

### 5.3 刷新 Token

```http
POST https://auth.example.com/auth/refresh
X-Portal: admin
X-App-Code: soft-copyright
```

前端必须使用 `credentials: 'include'`，浏览器会自动发送 HttpOnly refresh Cookie。成功响应仍为：

```json
{ "accessToken": "<new-access-token>" }
```

### 5.4 退出登录

```http
POST https://auth.example.com/auth/logout
Authorization: Bearer <accessToken>
X-Portal: admin
X-App-Code: soft-copyright
```

认证中心会撤销 access/refresh Session 并清理 Cookie。

### 5.5 跨域 Cookie 要求

- 认证中心 CORS 必须显式包含 `https://soft.example.com`，不能使用 `*`。
- 前端请求必须使用 `credentials: 'include'`。
- 认证中心当前 Cookie 是 host-only、`HttpOnly`、`SameSite=Lax`，由认证中心域名保存；前端不应尝试读取。
- `soft.example.com` 与认证中心建议位于同一站点根域，例如 `auth.example.com`，以降低浏览器跨站 Cookie 限制风险。
- 若认证中心不在同一站点根域，直接登录后的 refresh Cookie 可能受第三方 Cookie 策略影响；应优先完成后续授权码 SSO 改造。

## 6. 软著业务后端接入

### 6.1 JWT 验签

认证中心的 JWKS 地址：

```text
GET https://auth.example.com/auth/jwks.json
```

软著业务后端应缓存 JWKS，并按 JWT header 的 `kid` 选取公钥。只接受：

| Claim | 必须值 |
| --- | --- |
| `alg` | `RS256` |
| `iss` | `AUTH_JWT_ISSUER`，例如 `hqx-auth` |
| `aud` | `soft-copyright` |
| `app_code` | `soft-copyright` |
| `exp` | 必须晚于当前时间 |
| `sub` | 统一用户 ID |
| `jti` | 会话 ID |

业务后端必须拒绝 `aud` 或 `app_code` 不是 `soft-copyright` 的 Token。不能只检查签名，否则 KJQB Token 可能被错误接受。

JWT 不承载实时权限列表。每个需要最新权限的业务操作，应通过认证中心 `/auth/codes` 读取，或在后续“权限版本/鉴权查询接口”上线后使用该接口。

### 6.2 业务接口鉴权建议

```text
1. 提取 Bearer Token。
2. 从 JWKS 验证 RS256 签名和 kid。
3. 验证 iss、aud、app_code、exp。
4. 使用 sub 作为统一用户 ID。
5. 用权限码检查当前操作；高风险操作再向认证中心查询最新权限。
```

不要把 KJQB 的 `admin` 全局权限绕过规则复制到软著系统。软著系统的角色和权限必须只查询 `app_code = 'soft-copyright'`。

## 7. 数据初始化与管理

已执行的初始化命令：

```powershell
npm run auth:register-app -- --code soft-copyright --name "软件著作权管理系统" --portal admin

npm run auth:bootstrap-app-admin -- --app-code soft-copyright --username admin --client-id soft-copyright-web --redirect-uri https://soft.example.com/auth/callback --portal admin
```

验证命令：

```powershell
npm run verify:auth-app-bootstrap -- --app-code soft-copyright --username admin --client-id soft-copyright-web --redirect-uri https://soft.example.com/auth/callback
```

新增软著普通用户时，至少要完成三项：

1. 在 `sys_user` 中存在启用的统一用户。
2. 在 `sys_user_app` 中授予 `soft-copyright` + 对应 portal 的启用记录。
3. 为该用户绑定 `sys_role` 中 `app_code = 'soft-copyright'` 的角色。

软著系统的菜单、权限和角色不得直接复制 KJQB 数据。建议以软著业务动作设计权限码，例如：

```text
SoftCopyright:Application:List
SoftCopyright:Application:Create
SoftCopyright:Application:Edit
SoftCopyright:Application:Submit
SoftCopyright:Certificate:Read
SoftCopyright:Certificate:Upload
SoftCopyright:User:Manage
```

## 8. 上线顺序

1. 部署 Redis，确认 `/health/redis` 返回 `ok`。
2. 配置 CORS、Redis、RS256 密钥，先以 `AUTH_TOKEN_MODE=dual` 发布认证中心。
3. 重启认证中心，使用 KJQB 和软著系统分别登录，确认用户应用隔离。
4. 软著业务后端接入 JWKS 验签，并强制 `aud=soft-copyright`。
5. 软著前端接入登录、刷新、退出、userinfo、codes，验证跨域 Cookie。
6. 配置软著系统自己的菜单、权限和普通角色。
7. 观察 accessToken 过期周期后，将认证中心切换为 `AUTH_TOKEN_MODE=jwt`。
8. 实现并上线授权码 SSO 后，再将浏览器登录切换为跳转式流程。

## 9. 验收清单

- [ ] `admin` 使用 `appCode=soft-copyright` 可以登录。
- [ ] 使用 KJQB Token 调用软著业务后端返回 401/403。
- [ ] 使用软著 Token 调用 KJQB 业务接口返回 401/403。
- [ ] `/auth/userinfo` 返回 `appCode=soft-copyright`。
- [ ] `/auth/codes` 只返回软著系统权限码。
- [ ] refresh 请求带 `X-App-Code: soft-copyright` 后可以获得新 Token。
- [ ] logout 后旧 accessToken 和 refreshToken 均不可再用。
- [ ] 软著业务后端拒绝无效签名、过期 Token、错误 audience、错误 app_code。
- [ ] JWKS 的 `kid` 与认证中心 `AUTH_JWT_KEY_ID` 一致。
- [ ] 软著菜单和角色不显示 KJQB 数据。

## 10. 回滚

- JWT 异常：将 `AUTH_TOKEN_MODE` 回退为 `legacy`，并重启认证中心。
- Redis 异常：将 `AUTH_SESSION_STORE` 回退为 `memory`，并重启认证中心；所有 Redis 会话会失效，用户重新登录。
- 软著应用暂缓：将 `sys_app.status`、`sys_user_app.status`、`sys_app_client.status` 设为 `0`，保留数据以便恢复。
- 数据库迁移前备份位于 `backend/backups/`，该目录已被 Git 忽略。

## 11. 常见问题

| 现象 | 排查与处理 |
| --- | --- |
| 登录提示无该系统访问权限 | 检查 `sys_app`、`sys_user_app` 是否启用，并确认用户已绑定软著应用角色。 |
| 登录成功但菜单为空 | 初始管理员角色没有菜单；为 `soft-copyright` 创建菜单、权限并绑定角色。 |
| refresh 提示缺少刷新令牌 | 检查 `credentials: 'include'`、`X-App-Code`、CORS 和浏览器 Cookie 策略。 |
| 软著后端验签失败 | 刷新 JWKS 缓存，检查 `kid`、公钥、`iss`、`aud` 和 `app_code`。 |
| Redis Session 无法使用 | 检查 `REDIS_ENABLED`、`REDIS_URL`、密码和 `/health/redis`；不要在 Redis 不可用时设置 `AUTH_SESSION_STORE=redis`。 |
| 期待跳转式 SSO 但没有 code | 当前尚未实现授权码端点；使用本文的直接登录方式，或等待授权码 SSO 阶段上线。 |
