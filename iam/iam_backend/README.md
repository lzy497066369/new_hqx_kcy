# IAM Backend

统一 IAM/SSO 后端，提供 OAuth2 Authorization Code + PKCE、RS256 JWT/JWKS、应用级角色权限菜单、公司范围授权和统一 SSO 注销。

## 本地运行

```powershell
npm run db:migrate
npm run start:dev
```

默认地址为 `http://localhost:3101`。生产环境必须设置稳定的 `IAM_JWT_PRIVATE_KEY_BASE64` 与 `IAM_JWT_KEY_ID`，以便业务服务通过 JWKS 长期验签。

## IAM 管理员

IAM 管理端使用数据库用户认证。只有被分配 `iam_admin` 应用下 `super_admin` 角色的启用用户，才能登录 IAM 管理端和调用 `/iam/admin/*` 接口。首次以迁移的历史明文密码成功登录后，密码会自动升级为 `scrypt`。

管理员重置用户密码或停用用户后，IAM 会立即撤销该用户的 SSO 会话和刷新令牌；已签发的 accessToken 在其短期有效期结束后失效。

停用 IAM 应用会立即阻止该应用所有 OAuth Client 的授权码和刷新令牌签发。

审计事件保存在 `iam_audit_event`，可由 IAM 管理端的“审计日志”页面查看。它记录身份和授权流程及所有成功的 IAM 管理写操作的必要元数据，不记录密码、Token、Cookie、Client Secret 或请求体。

`IAM_BOOTSTRAP_USERNAME` 和 `IAM_BOOTSTRAP_PASSWORD` 只作为首次初始化应急入口。它在生产环境默认关闭；创建数据库 `super_admin` 后，应显式设置 `IAM_ENABLE_BOOTSTRAP_LOGIN=false` 并移除默认密码。

首次创建管理应用、`super_admin` 角色和管理员用户可使用一次性命令：

```powershell
$env:IAM_INITIAL_ADMIN_USERNAME = 'your_admin_username'
$env:IAM_INITIAL_ADMIN_PASSWORD = 'a-strong-password'
npm run bootstrap:admin
```

命令可重复执行，不会重复创建授权关系；已存在同名用户不会重置其密码。

## 首批系统迁移

迁移工具默认仅预检，不写入数据：

```powershell
node scripts/import-legacy-data.cjs
```

确认预检统计后，使用 `--apply` 导入到独立 IAM 数据库：

```powershell
node scripts/import-legacy-data.cjs --apply
```

迁移内容：`kjqb_admin`、`kjqb_client`、用户、角色、权限、菜单、企业、负责人、企业成员和项目老师范围。脚本可重复执行，旧业务库只读；首次导入的旧密码会在用户首次成功登录后升级为 `scrypt`。

可通过环境变量覆盖来源库：`LEGACY_DB_HOST`、`LEGACY_DB_PORT`、`LEGACY_DB_DATABASE`、`LEGACY_DB_USERNAME`、`LEGACY_DB_PASSWORD`。IAM 目标库使用 `IAM_DB_*` 配置。

## 验证

```powershell
npm test
npm run verify:test-cleanup
```
