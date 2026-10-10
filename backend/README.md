# Backend

NestJS backend for `new_kjqb`.

## Stack

- NestJS
- TypeORM
- MySQL 5.6 compatible schema
- Redis ready for later auth/session caching

## Scope

- `POST /auth/login`
- `GET /user/info`
- `GET /menu/all`
- `GET /auth/codes`
- `POST /auth/refresh`
- `POST /auth/logout`

## Compatibility notes

- Database schema avoids MySQL 8-only features.
- No JSON column, CTE, window function, generated column, or invisible index usage.
- Use `varchar`, `datetime`, `tinyint`, and join tables for portability.
- Import `sql/schema.mysql56.sql` on the online MySQL 5.6.50-log server.

## Database delivery

- 新环境：执行 `sql/schema.mysql56.sql`，再按需要单独执行 `sql/region-init-2025.sql`；不要执行历史演示数据脚本。
- 已有环境：先运行 `npm run db:migrate` 查看受控升级顺序，再运行 `npm run db:migrate:status` 只读检查已执行记录。
- 明确仍停留在 `2026-07-04` 基线的库：确认备份后运行 `npm run db:migrate -- --apply --allow-untracked-history`。
- 已上线且历史执行状态不确定的库：完成结构核对后运行 `npm run db:migrate -- --adopt-current --confirm-adopt-current`，仅登记当前结构，不执行历史 SQL；后续新增迁移将正常登记。
- 脚本会在 `sys_schema_migration` 保存成功执行文件的 SHA-256；失败的迁移不会登记，修复后可重试。
- 测试、预发布和生产环境必须设置 `DB_SYNCHRONIZE=false`。结构变更只能通过新的、可登记的 SQL 迁移交付。

## Verification

- `npm run test` 会构建后端并执行离线安全边界检查，不连接数据库。
- `npm run verify:security-boundaries` 会基于已有构建产物执行同一组检查。

## Upload Access

- 企业附件不再通过 `/uploads/enterprise/` 或通用 `/upload/stream/*` 访问，必须使用对应企业记录的受控预览接口。
- 通用流式上传单文件上限为 20 MiB；超限或传输失败时会删除未完成文件。

## CORS

- 开发环境默认仅允许 `http://localhost:5998`、`http://localhost:5999` 及其 `127.0.0.1` 等价地址。
- 生产环境必须通过 `CORS_ORIGINS` 配置前端源（逗号分隔）；未配置时不允许跨域请求。

## CRM 同步接口

完整的 CRM 对接说明见 [docs/crm-sync-api.md](docs/crm-sync-api.md)，包含字段约束、幂等重发、业务状态、错误处理及完整示例。

CRM v2 安全对接说明见 [docs/crm-integration-v2-api.md](docs/crm-integration-v2-api.md)。新接入必须使用 v2 的 HMAC-SHA256 签名；v1 的静态 `X-Crm-Token` 仅用于短期兼容。

CRM 调用必须携带 `X-Crm-Token`，其值与后端环境变量 `CRM_SYNC_TOKEN` 一致。合同和执行单均以 `sourceRequestId` 幂等；同一请求重复推送只返回已存记录，不会重复创建企业或申报。

`POST /integration/crm/contracts`

```json
{
  "sourceRequestId": "crm-contract-20260722-001",
  "companyName": "示例科技有限公司",
  "sequenceNo": "1",
  "contractNo": "H12381",
  "customerContractNo": "PO-001",
  "vendorName": "厂商名称",
  "contractName": "2026 年高企服务合同",
  "accountManagerName": "客户经理"
}
```

该接口会复用现有天眼查搜索和企业导入逻辑自动创建或更新企业资料，但固定禁用企业账号创建。合同数据只保存至 CRM 合同同步记录，**不会写入企业合同台账**。

`POST /integration/crm/execution-orders`

```json
{
  "sourceRequestId": "crm-order-20260722-001",
  "orderNo": "E47864",
  "companyName": "示例科技有限公司",
  "contractNo": "H12381",
  "contractReviewStatus": "已审核",
  "executionOrderName": "2026 年国家高新技术企业申报资料整理，15 件知识产权",
  "isCarriedForward": "否",
  "executionDepartment": "PG-Other|其他",
  "accountManagerName": "客户经理",
  "productManagerName": "产品经理"
}
```

名称命中高企时自动创建“国家高新技术企业”申报；命中科小/科技型中小企业时自动创建“省级科技型中小企业”申报；名称中的“知识产权 N 件/项/个”会单独记录数量。未识别到高企或科小的执行单保留记录并标记为“无需创建”，不额外创建企业或申报。失败记录可在后台“CRM同步”中重新执行。

## Authentication Safety

- 登录失败会按账号和来源地址执行内存节流：15 分钟内累计 5 次失败后锁定 15 分钟。
- 当前节流与会话均为单进程内存实现；多实例生产部署前需要替换为 Redis 等共享存储。
