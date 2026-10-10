# 总负责人直接管理企业负责人和企业档案

## 当前业务链路

**总负责人 → 企业负责人**。区域负责人身份、页面、账号创建/分发中间环节和按区域负责人授权的代码已移除。区域仅作为企业档案的地理分类，仍可用于筛选和汇总，不再决定账号归属或可接收企业的范围。

- 总负责人：`/governance/regions`，页面包含“区域概况”“企业负责人”“企业档案总览”；可直接创建企业负责人、企业建档、查看详情并分发企业档案。区域行仍可展开查看企业。
- 总负责人旧入口 `/governance/accounts`、`/governance/all-enterprises` 分别跳转至账号、企业档案分区。
- 企业负责人：`/client/enterprise-receipts`，接收总负责人分发的企业档案；新账号未分发企业时也可登录，接收列表为空。
- 区域负责人原入口 `/governance/enterprises`、`/governance/project-accounts`、`/governance/region-accounts` 不再作为管理入口。登录页只提供企业负责人、总负责人两种身份；旧区域负责人角色不能登录或继续使用缓存会话。

## 创建账号、建档和分发

1. 总负责人直接填写企业负责人姓名、登录账号、初始密码；无需选择区域，也无需创建区域负责人。
2. 建档填写企业名称、所属区域、销售负责人。可多选企业项目：国家科技型技术企业、省级科技型技术企业、国家高新技术企业、专精特新企业。信用代码及其他资料后续补齐，不生成虚假信用代码。
3. 新档案独立保存为待分发状态。企业档案总览也包含未设置区域或所属区域已停用的历史档案；新建档案只能选择启用区域。
4. 点击“分发”选择当前应用中已启用的企业负责人，不再限制同一区域。一个账号可接收多个企业，可跨区域接收。
5. 后端检查总负责人身份、应用和门户范围、接收账号及应用授权状态、角色互斥条件；拒绝包含旧区域负责人身份的混合角色账号。
6. 分发仅新增企业关联，不清空接收人的其他企业。重复提交同一接收人为幂等操作；已关联其他负责人的档案不能通过本入口直接转交。批量失败时事务回滚。
7. 企业负责人刷新接收列表或重新登录后可见企业。企业负责人本身不能创建账号、建档或分发；旧自助绑定及借用后台建档入口仍拒绝客户端建档。

## 兼容与凭据安全

- 新建企业负责人沿用内部角色 `project_teacher` 和 `biz_enterprise_teacher` 多企业关联模型，不改动历史企业负责人账号及企业分发关系。兼容既有 `enterprise_owner` 账号和 `biz_enterprise_owner` 关联，并检查两种关联的分发冲突。
- API 保留 `projectAccounts`、`projectUserId` 和批量分发接口名称，仅作为兼容字段/路径；它们不代表旧的区域中间层。账号创建请求不再有 `regionId`，企业建档仍有该字段。
- 密码使用哈希保存，不提供历史密码查询。创建成功返回的初始密码仅存在当前页面内存，默认遮挡；关闭成功弹窗、页面卸载或 KeepAlive 停用后清空，不写入浏览器持久存储。
- `GET /client/governance/enterprises/:id` 仅供总负责人只读查看档案详情；企业负责人不可调用该管理接口。
- 旧区域负责人账号不自动升级为总负责人或企业负责人。迁移仅停用其对应客户端应用授权和旧角色，保留用户记录；如需继续使用，应经人工确认后重新授予合适身份、移除旧角色绑定。其他应用及管理端授权不受该客户端角色停用操作影响。

## 数据库与发布

使用项目标准迁移流程，先备份并在测试环境检查迁移状态，再在维护窗口完成待执行迁移和前后端同步发布。不能仅发布前端隐藏入口。

后端迁移清单 `sql/migrations/manifest.json` 已注册：

1. `20261001_01_governance_enterprise_distribution`：企业区域、销售负责人、可空信用代码；历史迁移未修改。
2. `20261001_02_governance_enterprise_projects`：企业多选项目；历史迁移未修改。
3. **`20261001_03_governance_direct_enterprise_accounts`**：`sql/governance-direct-enterprise-accounts-p1.sql`，退役区域负责人中间链路。

第三项在停用中间关系前补齐缺失的企业地理归属；随后停用旧角色对应的客户端应用授权、旧菜单和 `biz_region_project_user` 关系，清空区域负责人字段，并修正有效身份的旧登录首页。不删除用户、企业档案、teacher/owner 分发关系。中间表仅为审计保留，运行时代码和实体注册已移除；不用 `synchronize` 自动删除历史表或字段。

```sh
# backend 目录：先检查，再按变更审批流程执行
npm run db:migrate:status
npm run db:migrate
```

启用 IAM/SSO 的环境还需在 `iam/iam_backend` 执行标准 `npm run db:migrate` 流程，新增迁移为 `sql/012-retire-regional-leader.sql`，停用 `kjqb_client` 旧区域负责人角色、应用授权及旧菜单。旧库导入脚本也已防止再次导入/启用该身份；企业成员关系保持不变。

构建发布应使用干净输出目录，避免增量构建残留已删除的 `region-project-user.entity.js`。所有后端实例需同步更新，旧区域负责人登录及旧会话都应在发布后验证为拒绝访问。

**本次仅添加迁移文件，未连接数据库执行迁移，也未推送或部署。**

## 验证

```sh
# backend
npm run build
npm run verify:client-governance
npm run verify:governance-distribution
npm run verify:governance-distribution-db

# vue-admin
pnpm -F @vben/web-client run typecheck
pnpm -F @vben/web-client run build
pnpm exec vitest run --dom apps/web-client/src/auth/client-persona.test.ts apps/web-client/src/auth/client-home-path.test.ts apps/web-client/src/router/access.test.ts apps/web-client/src/views/client/governance/overview.test.ts
```

数据库集成验证仅允许 localhost/127.0.0.1/::1，在事务内创建临时区域、账号及企业并最终回滚，要求先完成迁移，不自动同步表结构。本次未执行该数据库集成验证。

2026-10-01 本地检查：客户端相关 4 个测试文件的 30 项测试、类型检查及生产构建通过，管理端区域页面类型检查通过；后端账号与分发专项验证通过，IAM 导入/迁移源码契约检查共 9 项通过（不代表实际执行 SQL）。后端完整构建仍被本次未修改的事务/查询辅助代码及拆分 client service 中的 40 项类型错误阻塞，不应据此视为完整发布验证通过。IAM 完整构建及前端类型检查缺少各自依赖，尚未通过；上线前需补齐依赖并重新验证。

补充回归结果：Redis、SQL runner、会话、JWT、企业材料归属验证通过。认证 stage0 的旧默认配置断言（未包含 `clientOnly`）、认证应用范围 stage2 的旧源码断言（要求调用 `getFullClientPermissions`）、security-boundaries 的历史明文密码兼容断言仍失败；未为了通过旧断言重新放宽认证或密码安全策略。后端专项脚本使用本次 TypeScript 编译产生的 JS，不能替代完整构建或真实数据库集成测试。
