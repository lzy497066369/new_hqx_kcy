# IAM Frontend

统一 IAM/SSO 管理端。该目录从现有 `vue-admin/apps/web-admin` 裁剪而来，保留 Vben 的布局、认证和组件依赖，删除企业、政策、AI、财务等业务页面。

## 运行

后端先运行：

```powershell
Set-Location ..\iam_backend
npm run start:dev
```

前端运行：

```powershell
Set-Location ..\iam_frontend
pnpm dev
```

默认地址为 `http://localhost:6101`。开发环境通过 `/api` 代理访问 `http://localhost:3101`。

IAM 管理端只能由 IAM 数据库中拥有 `super_admin` 角色的用户访问。引导账号仅用于本地首次初始化；生产环境须在创建数据库管理员后禁用 `IAM_ENABLE_BOOTSTRAP_LOGIN`。

## 依赖说明

当前前端仍复用仓库内 `vue-admin` 工作区的共享包。待 IAM 数据模型和管理页面稳定后，再将共享包提取为根级 workspace，避免现在过早复制整套 Vben 基础设施。
