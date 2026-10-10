# IAM 本地运行

本地开发默认使用独立的 `iam_sso` 数据库。IAM 后端启动时会读取根项目的 `backend/.env`，仅复用数据库连接信息；IAM 数据库名称固定默认为 `iam_sso`，不会使用业务库的 `DB_DATABASE`。

## 启动顺序

```powershell
Set-Location iam/iam_backend
npm run db:migrate
npm run start:dev

Set-Location ../iam_frontend
pnpm dev
```

默认地址：

- IAM 管理端：`http://127.0.0.1:6101/`
- IAM 后端：`http://127.0.0.1:3101/`
- 健康检查：`http://127.0.0.1:3101/health`

本地 JWT 的默认 `IAM_ISSUER` 是 `http://localhost:3101`。JWT 的 issuer 按字符串精确匹配，业务端的 `IAM_ISSUER` 和 `IAM_JWKS_URL` 必须同样使用 `localhost`；不要把它们改成 `127.0.0.1`。浏览器和健康检查仍可使用 `127.0.0.1`。

首次初始化管理员：

```powershell
$env:IAM_INITIAL_ADMIN_USERNAME = 'your_admin_username'
$env:IAM_INITIAL_ADMIN_PASSWORD = 'use-a-local-password'
npm run bootstrap:admin
```

生产环境必须显式配置 `IAM_DB_*`、`IAM_ISSUER`、`IAM_JWT_PRIVATE_KEY_BASE64` 和 `IAM_JWT_KEY_ID`，不能依赖本地默认值。
