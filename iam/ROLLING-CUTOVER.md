# IAM/SSO 双跑与切换说明

## 目标与边界

`iam_backend` 是统一身份与授权中心，管理应用、用户、OAuth Client、角色、权限、菜单、公司摘要及公司范围。业务后端保留企业档案、申报、财务等业务数据。

公司范围的身份来源为 IAM，业务企业 ID 使用 `iam_company.source_company_id` 映射。不要把公司范围放入 JWT；业务后端会通过 IAM 公司上下文接口读取范围，并做短缓存。

## 当前应用

| 应用 | appCode | OAuth clientId | 前端回调地址 | 业务后端 portal |
| --- | --- | --- | --- | --- |
| 管理端 | `kjqb_admin` | `kjqb_admin_web` | `http://localhost:5999/auth/callback` | `admin` |
| 客户端 | `kjqb_client` | `kjqb_client_web` | `http://localhost:5998/auth/callback` | `client` |

生产环境必须以实际域名替换回调地址，并在 IAM 的 OAuth Client 白名单中逐条登记。回调地址不得使用模糊匹配。

## 配置

IAM 后端：

```env
PORT=3101
IAM_ISSUER=https://iam.example.com
IAM_CORS_ORIGIN=https://iam.example.com,https://admin.example.com,https://client.example.com
IAM_JWT_PRIVATE_KEY_BASE64=<base64-encoded-rsa-private-key>
IAM_JWT_KEY_ID=iam-rs256-1
IAM_DB_DATABASE=iam_sso
# Production defaults to disabled. Create a database user with the super_admin role first.
IAM_ENABLE_BOOTSTRAP_LOGIN=false
```

业务后端在 IAM 模式下：

```env
IAM_AUTH_MODE=jwt
IAM_ISSUER=https://iam.example.com
IAM_CONTEXT_URL=https://iam.example.com
IAM_JWKS_URL=https://iam.example.com/.well-known/jwks.json
IAM_APP_CODE=kjqb_admin
IAM_CLIENT_ID=kjqb_admin_web
IAM_PORTAL=admin
IAM_COMPANY_SOURCE_SYSTEM=<legacy-source-system>
IAM_COMPANY_SCOPE_CACHE_TTL_MS=30000
```

客户端业务后端实例使用 `kjqb_client`、`kjqb_client_web` 和 `client`。`IAM_COMPANY_SOURCE_SYSTEM` 必须等于迁移脚本使用的来源系统名，默认是旧业务数据库名。

业务前端：

```env
VITE_AUTH_MODE=iam
VITE_IAM_ISSUER=https://iam.example.com
VITE_IAM_CLIENT_ID=kjqb_admin_web
VITE_IAM_REDIRECT_URI=https://admin.example.com/auth/callback
VITE_APP_CODE=kjqb_admin
```

客户端前端替换为 `kjqb_client_web`、客户端回调地址和 `kjqb_client`。

## 首次切换步骤

1. 为 IAM 配置稳定的 RSA 私钥和 `IAM_JWT_KEY_ID`，启动 IAM 后验证 `/.well-known/jwks.json`。
2. 执行 `npm run db:migrate`（在 `iam/iam_backend`）。
3. 先执行 `node scripts/import-legacy-data.cjs` 预检，确认统计数据。
4. 执行 `node scripts/import-legacy-data.cjs --apply`。脚本幂等，旧业务库只读；它会补齐用户来源 ID、企业来源 ID、企业负责人/成员/项目老师范围，以及旧 `admin` 用户的管理端 `dataScope=all`。
5. 通过 `npm run bootstrap:admin` 创建 `iam_admin` 管理应用、至少一个 IAM 数据库用户和该应用下的 `super_admin` 角色；确认可登录 IAM 管理端后设置 `IAM_ENABLE_BOOTSTRAP_LOGIN=false`。生产环境不得保留默认引导密码。
6. 在 IAM 管理端核对每个应用的 OAuth Client 回调地址、用户应用授权、角色、菜单和公司范围。
7. 先在一个测试环境设置 `VITE_AUTH_MODE=iam`，业务后端保持 `IAM_AUTH_MODE=local`，确认 SSO 登录、回调、菜单和权限。
8. 再设置业务后端 `IAM_AUTH_MODE=jwt`，分别对 admin/client 使用对应的 `IAM_APP_CODE`、`IAM_CLIENT_ID`、`IAM_PORTAL` 配置。
9. 完成下面的验收清单后，再扩大到生产流量。

## 验收清单

- 管理端和客户端均能跳转 IAM 登录，已存在 SSO 会话时不再输入密码。
- OAuth 回调可换取 Token，业务后端可通过 JWKS 验签。
- IAM 菜单接口返回的菜单与角色权限一致，未授权菜单和按钮不可用。
- `project_teacher` 只能读取 IAM 分配的企业。
- 企业负责人和企业成员只能切换 IAM 分配的企业。
- 客户端切换企业时，业务后端先调用 IAM 更新默认公司，再更新本地当前企业上下文；IAM 不可用或目标企业未授权时切换失败。
- `dataScope=all` 用户可看到全部业务企业。
- 在 IAM 管理端移除某公司范围后，最长在 `IAM_COMPANY_SCOPE_CACHE_TTL_MS` 后对业务接口生效。
- IAM 不可用时，JWT 模式下公司范围请求失败关闭，不会改用旧绑定表扩大权限。
- 退出登录后刷新令牌不可再使用。
- 刷新令牌轮换后，重放旧刷新令牌会触发该 SSO 会话的刷新令牌链撤销，并记录失败审计。
- IAM 管理端的审计日志可查询登录、SSO 会话、授权码签发及交换、刷新令牌轮换、统一注销和所有成功的 IAM 管理写操作；授权码交换和刷新令牌轮换的失败事件同样可追溯，日志中不存储密码、Token、Client Secret 或请求体。
- IAM 管理端重置用户密码或停用用户时，会立即撤销该用户的 SSO 会话和刷新令牌；已签发的短期 accessToken 按自身过期时间自然失效。
- 停用 IAM 应用后，该应用下的 OAuth Client 会立即停止授权码和刷新令牌签发；已签发的短期 accessToken 按自身过期时间自然失效。
- 仅拥有 `iam_admin` 应用下 `super_admin` 角色的 IAM 数据库用户可调用 `/iam/admin/*`；普通业务用户和其他业务应用中的同名角色不得访问 IAM 管理接口。
- IAM 管理员登录优先校验数据库身份；首次以历史明文密码成功登录后会自动升级为 `scrypt`。引导账号仅用于首次初始化，生产必须禁用。

## 回滚

将业务前端的 `VITE_AUTH_MODE` 改回 `local`，并将业务后端的 `IAM_AUTH_MODE` 改回 `local` 后重新发布对应服务。IAM 的数据、迁移脚本和旧业务表均无需回滚或删除。

## 验证命令

```powershell
Set-Location iam/iam_backend
npm test
npm run verify:test-cleanup
npm run verify:business-sso-e2e

Set-Location ../../backend
npm run build
npm run verify:iam-jwt-mapping
npm run verify:iam-company-scope
```

要运行 IAM 数据库集成用例，需在执行测试的进程中提供完整的 `IAM_DB_*` 环境变量；未配置时这些用例会跳过。
