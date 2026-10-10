# 企业管理一级目录重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后台企业功能重构为企业服务中心统计、企业材料台账、企业申报管理三个并列一级目录，并实现跨企业申报聚合视图。

**Architecture:** 保留现有显式 `enterpriseId` 的维护路由作为隐藏详情入口。菜单和路由新增三个顶级节点；后端以 `EnterpriseProfileService.list(..., currentUser)` 计算跨企业申报范围；前端以路由页编排请求，卡片、筛选、列表分别拆为明确组件。

**Tech Stack:** NestJS + TypeORM，Vue 3 `<script setup lang="ts">`，Ant Design Vue，Vben Admin，MySQL。

---

## 文件结构

- 修改 `vue-admin/apps/web-admin/src/router/routes/modules/enterprise.ts`：声明三个根目录和隐藏详情路由。
- 新建 `backend/sql/enterprise-top-level-menu-p2.sql`：可重复执行的菜单迁移。
- 修改 `backend/scripts/verify-enterprise-workspace-menu.cjs`、`backend/scripts/verify-enterprise-workspace-menu-db.cjs`：验证新菜单树。
- 修改 `backend/src/modules/enterprise/workspace/workspace.controller.ts`、`workspace.service.ts`：增加安全的跨企业申报列表。
- 修改 `vue-admin/apps/web-admin/src/api/enterprise/workspace.ts`：定义分页列表类型与请求函数。
- 新建 `views/enterprise/profile/components/EnterpriseCard*.vue`：企业卡片筛选、列表、单卡片。
- 修改 `views/enterprise/profile/list.vue`：用卡片容器替换 VXE 表格。
- 修改 `views/enterprise/workspace/materials/index.vue`：默认首企业、分页与聚合分类展示。
- 新建 `views/enterprise/declarations/list.vue`、`detail.vue`：跨企业申报列表和独立详情页。

### Task 1: 调整静态路由与可重复执行菜单补丁

**Files:**
- Modify: `vue-admin/apps/web-admin/src/router/routes/modules/enterprise.ts`
- Create: `backend/sql/enterprise-top-level-menu-p2.sql`
- Modify: `backend/scripts/verify-enterprise-workspace-menu.cjs`
- Modify: `backend/scripts/verify-enterprise-workspace-menu-db.cjs`

- [ ] **Step 1: 写入新路由树**

将可见根目录限定为：

```ts
{ name: 'EnterpriseServiceStatistics', path: '/enterprise-service-statistics' }
{ name: 'EnterpriseMaterialLedgerRoot', path: '/enterprise-material-ledger' }
{ name: 'EnterpriseDeclarationManagement', path: '/enterprise-declaration-management' }
```

企业列表作为统计根目录的 `enterprises` 子路由；材料和申报列表分别作为各自根目录的默认子路由；现有 `EnterpriseWorkspace*` 使用 `hideInMenu: true` 保留。

- [ ] **Step 2: 写入菜单 SQL**

SQL 使用 `INSERT ... SELECT ... WHERE NOT EXISTS` 创建三个根菜单并更新已有动态节点父级。根菜单路径分别是 `/enterprise-service-statistics`、`/enterprise-material-ledger`、`/enterprise-declaration-management`，均限制 `portal_type = 'admin'` 和 `auth_code = 'Enterprise:Profile:List'`。企业列表菜单的 `parent_id` 必须引用 `EnterpriseServiceStatistics`。

- [ ] **Step 3: 更新静态和数据库菜单校验**

校验数组必须包括三个根菜单、`EnterpriseProfileList`、`EnterpriseMaterialLedger`、`EnterpriseDeclarationList` 及所有 `EnterpriseWorkspace*` 隐藏路由。数据库校验需验证根路径、权限、企业列表父级和隐藏节点归属。

- [ ] **Step 4: 运行静态校验**

Run: `npm run verify:enterprise-workspace-menu --prefix backend`

Expected: `Enterprise workspace menu verification passed`。

### Task 2: 实现跨企业申报聚合接口

**Files:**
- Modify: `backend/src/modules/enterprise/workspace/workspace.controller.ts`
- Modify: `backend/src/modules/enterprise/workspace/workspace.service.ts`
- Modify: `vue-admin/apps/web-admin/src/api/enterprise/workspace.ts`

- [ ] **Step 1: 添加控制器路由**

在 `enterprises/:enterpriseId/declarations` 之前增加：

```ts
@Get('declarations')
@RequirePermissions('Enterprise:Profile:List')
listDeclarationLedger(@CurrentUserInfo() user: CurrentUser, @Query() query: Record<string, string | string[] | undefined>) {
  return this.enterpriseWorkspaceService.listDeclarationLedger(query, user);
}
```

- [ ] **Step 2: 以企业范围过滤申报**

实现 `listDeclarationLedger(query, currentUser)`：先调用 `enterpriseProfileService.list({ page: '1', pageSize: '100000' }, currentUser)`，再以 `In(enterpriseIds)` 查询申报。仅接受范围内的 `enterpriseId`，按 `status`、关键字匹配企业名/项目名/申报编号，按 `updatedAt DESC` 分页。返回：

```ts
{ items: rows.map(item => ({ ...this.toDeclarationWorkspaceItem(item), enterpriseId: String(item.enterpriseId), enterpriseName: item.enterpriseName })), page, pageSize, total }
```

- [ ] **Step 3: 前端 API 契约**

新增 `EnterpriseDeclarationLedgerItem`、`EnterpriseDeclarationLedgerParams` 和：

```ts
requestClient.get<{ items: EnterpriseDeclarationLedgerItem[]; page: number; pageSize: number; total: number }>(
  '/enterprise-workspace/declarations', { params },
)
```

- [ ] **Step 4: 安全验证**

Run: `npm run build --prefix backend && npm run verify:security-boundaries --prefix backend`

Expected: 构建成功且输出 `Security boundary verification passed.`。

### Task 3: 将企业列表改为卡片式页面

**Files:**
- Create: `vue-admin/apps/web-admin/src/views/enterprise/profile/components/EnterpriseCardFilters.vue`
- Create: `vue-admin/apps/web-admin/src/views/enterprise/profile/components/EnterpriseCardItem.vue`
- Create: `vue-admin/apps/web-admin/src/views/enterprise/profile/components/EnterpriseCardList.vue`
- Modify: `vue-admin/apps/web-admin/src/views/enterprise/profile/list.vue`

- [ ] **Step 1: 建立 typed 筛选和卡片事件契约**

`EnterpriseCardFilters` 使用 `defineModel` 绑定查询对象，发出 `search` 与 `reset`；`EnterpriseCardItem` 以 `EnterpriseProfileItem` 为只读 prop，发出 `detail`、`edit`、`workspace`、`accounts`、`delete`；`EnterpriseCardList` 负责 `loading`、`items`、`total`、`page` 和 `page-size` props，并发出 `changePage` 和卡片动作。

- [ ] **Step 2: 迁移列表页数据源**

以最小本地状态维护 `items`、`total`、`loading` 和 `query`，并调用：

```ts
const result = await getEnterpriseProfilesApi({ ...query.value, page: query.value.page, pageSize: query.value.pageSize });
items.value = result.items;
total.value = result.total;
```

保留已有导入、详情、编辑、企业用户、工作台、删除及概览刷新逻辑。状态更新成功后重新加载第一页。

- [ ] **Step 3: 运行 Web 管理端类型检查**

Run: `pnpm -F @vben/web-admin run typecheck --dir vue-admin`

Expected: exit code 0。

### Task 4: 完善企业材料台账

**Files:**
- Modify: `vue-admin/apps/web-admin/src/views/enterprise/workspace/materials/index.vue`

- [ ] **Step 1: 修正默认企业加载顺序**

`loadEnterprises` 成功后，在 `enterpriseId` 为空且企业存在时执行：

```ts
enterpriseId.value = enterprises.value[0].id;
```

初始加载只能在企业列表完成后触发；企业为空时清空行和总数。选择器清空仍传递 `undefined`，以支持显式“全部企业”。

- [ ] **Step 2: 增加分页和类型分组可读性**

依据当前 `materialType` 显示类型标签；无类型筛选时按 `type` 排序并使用标签列区分。保留企业列、资料名称、摘要、更新时间和“查看企业”动作；使用 `Pagination` 传递 `page` 与 `pageSize`。

- [ ] **Step 3: 回归类型检查**

Run: `pnpm -F @vben/web-admin run typecheck --dir vue-admin`

Expected: exit code 0。

### Task 5: 新建企业申报管理列表和详情

**Files:**
- Create: `vue-admin/apps/web-admin/src/views/enterprise/declarations/list.vue`
- Create: `vue-admin/apps/web-admin/src/views/enterprise/declarations/detail.vue`

- [ ] **Step 1: 构建跨企业申报列表**

列表页拉取可见企业用于筛选，并用 `getEnterpriseDeclarationLedgerApi` 请求分页数据。筛选字段为企业、状态、关键字；表格展示企业、项目、状态、当前节点、待补材料、截止日期和更新时间。点击“查看详情”必须导航：

```ts
router.push({ name: 'EnterpriseDeclarationDetail', params: { enterpriseId: record.enterpriseId, declarationId: record.id } });
```

- [ ] **Step 2: 构建独立申报详情**

详情页从路由读取参数并调用 `getEnterpriseWorkspaceDeclarationDetailApi(enterpriseId, declarationId)`。复用现有详情展示的材料准备度、流程历史和返回申报管理动作；不得从列表页透传或缓存申报数据。

- [ ] **Step 3: 检查路由深链接**

通过静态路由检查确认 `EnterpriseDeclarationDetail` 为隐藏菜单路由，并且参数名称为 `enterpriseId` 和 `declarationId`。

### Task 6: 执行菜单 SQL 与全量验证

**Files:**
- Modify: `backend/sql/enterprise-top-level-menu-p2.sql`（仅在发现回查缺项时修正）

- [ ] **Step 1: 执行数据库菜单补丁**

使用项目现有的本地 MySQL 环境执行：

```powershell
Get-Content -Raw backend/sql/enterprise-top-level-menu-p2.sql | mysql -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USERNAME -p$env:DB_PASSWORD $env:DB_DATABASE
```

- [ ] **Step 2: 运行菜单与构建校验**

Run:

```powershell
npm run verify:enterprise-workspace-menu --prefix backend
npm run verify:enterprise-workspace-menu-db --prefix backend
pnpm -F @vben/web-admin run lint --dir vue-admin
pnpm -F @vben/web-admin run typecheck --dir vue-admin
pnpm -F @vben/web-admin run build --dir vue-admin
```

Expected: 全部命令 exit code 0，数据库校验输出通过的新菜单数量。

