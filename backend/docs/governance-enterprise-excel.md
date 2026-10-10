# 企业建档：预申报年份与 Excel 导入导出

## 功能与使用

总负责人企业管理页提供新建企业档案、Excel 导入、Excel 导出；区域仍是企业档案的分类和筛选条件，导出采用当前企业名称/负责人关键词、区域及分发状态筛选，包含全部匹配记录，不局限于当前分页。

新建及导入均要求五字段必填：企业名称、区域、销售负责人、企业项目、预申报年份。

- 企业名称：2–128 字；销售负责人：1–64 字。
- 区域：必须匹配已启用区域的完整名称；有重名时拒绝自动选择。
- 企业项目：至少一个现有项目，多项用 `；` 分隔，也接受常见分隔符。不自动创建项目。
- 预申报年份：2000–2100 的四位整数；导入兼容 `2027年` 文本。没有默认年份。
- 历史档案的空项目/年份保持原样，列表显示“未填写”；不会编造或自动补全年份。

导入流程：下载标准模板 → 填表 → 上传 → 查看识别与校验结果 → 必要时手动指定工作表、表头行、字段对应列 → 重新识别 → 确认导入 → 查看结果/下载问题明细。

识别支持表头别名、列顺序变化、前置标题行（前 30 行）、多工作表及手动字段映射。只处理选中的一个可见工作表，不会合并所有工作表。解析失败、列缺失、无效项目/年份、公式等会有明确提示。

预览不写入数据库；确认仅新增校验通过的记录，问题行单独报告。同名企业（含已删除档案）及文件内重复记录跳过，不覆盖既有档案。导入后档案为待分发状态，需按原业务流程另行分发。

## 文件与运行限制

- 支持 `.xlsx`，不支持旧 `.xls`、CSV、加密工作簿。旧文件请先另存为 `.xlsx`。
- 每文件不超过 5 MB；最多 1000 条数据、100 列、20 个可见工作表；解压内容上限 30 MB。
- 不执行公式、宏或外部链接；有公式的字段请粘贴为值后上传。
- 预览凭证绑定当前应用、门户及账号，30 分钟有效；确认前重新校验区域和同名档案，重复确认返回同一结果。
- 预览缓存存放后端进程内存，重启后必须重新上传；多实例部署需保持同一实例路由，若需跨实例共享缓存应另行实施。

## 数据库与发布

迁移已注册到 `sql/migrations/manifest.json`：

`20261001_04_governance_enterprise_excel` → `sql/governance-enterprise-excel-p1.sql`

迁移为 `biz_enterprise` 增加可空 `pre_declaration_year SMALLINT`，可重复执行、兼容 MySQL 5.6；五字段必填在应用层保障，历史记录保持兼容。

发布前备份数据库，使用既有迁移管理流程检查并执行待执行项，再发布并重启后端、发布前端。不得在未知历史库上直接跳过登记保护或盲目重放整条历史迁移链。

```sh
# backend 目录；先查看状态及计划。执行迁移仍须遵循环境的审批与备份流程。
npm run db:migrate:status
npm run db:migrate
# 已正确登记历史迁移的环境：
npm run db:migrate -- --apply
```

## 验证

```sh
# backend
npm run build
npm run verify:governance-distribution
npm run verify:governance-excel
npm run verify:governance-excel-http
npm run verify:sql-runner
# vue-admin
pnpm --filter @vben/web-client typecheck
pnpm exec vitest run apps/web-client/src/views/client/governance/overview.test.ts
pnpm --filter @vben/web-client build
```

HTTP 专项测试使用隔离仓库和测试认证，验证真实 NestJS DTO、文件上传及二进制下载链路，不会创建业务档案；实际数据库分发集成验证使用独立临时数据并回滚。
