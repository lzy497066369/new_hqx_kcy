# CRM 同步入口表与数据库权限说明

> **【本次变更 | 2026-08-04】** 本版增加追加式业务事件字段和版本处理规则。新增或调整内容统一使用 `【本次变更】` 标记。

## 1. 文档目标

本文件说明 CRM 直连数据库时可写入的同步入口表、字段职责、处理状态、写入规范及数据库账号权限。

CRM 只能写入同步入口表，不能直接写企业、申报、方案、材料等正式业务表。后端轮询服务负责企业导入、执行单解析、申报创建及方案绑定。

【本次变更】CRM 新增、修改、作废同一业务单据时，都应追加写入一条新记录。每次变更使用新的 `source_request_id`，并携带稳定业务键 `source_record_id`、业务更新时间 `source_updated_at`、版本号 `source_version` 和事件类型 `event_type`。后端会按业务键和版本判断是否处理；旧版本自动标记为 `skipped`，作废事件只记录审计，不直接修改正式业务表。

```text
CRM INSERT 同步入口表
-> 后端轮询
-> processing
-> success / failed / skipped
```

## 2. 表一：合同同步记录

表名：`biz_crm_contract_sync_record`

### 2.1 用途

该表接收 CRM 合同信息，后端根据 `company_name` 导入或关联企业，并保存合同号与企业的关联结果。

这不是正式合同业务表，而是同步入口和处理审计记录。执行单存在 `contract_no` 时，会优先查找合同号相同且同步成功的记录，以关联已导入的企业。

### 2.2 字段说明

| 字段 | 类型 | 说明 | 维护方 |
| --- | --- | --- | --- |
| `id` | bigint | 主键 | 后端 |
| `source_request_id` | varchar(128) | CRM 唯一请求号，表内唯一 | CRM，必填 |
| 【本次变更】`source_record_id` | varchar(128) | CRM 侧合同业务主键，修改/作废同一合同时保持不变 | CRM，建议填写 |
| 【本次变更】`source_updated_at` | datetime | CRM 侧业务最后更新时间 | CRM，修改/作废时建议填写 |
| 【本次变更】`source_version` | varchar(64) | CRM 侧业务版本号 | CRM，可选 |
| 【本次变更】`event_type` | varchar(32) | 事件类型：`created` / `updated` / `cancelled` | CRM，可选，默认 `created` |
| `company_name` | varchar(255) | 客户企业名称 | CRM，必填 |
| `sequence_no` | varchar(64) | 序列号 | CRM，可选 |
| `contract_no` | varchar(128) | 合同号 | CRM，建议填写 |
| `customer_contract_no` | varchar(128) | 客户合同号 | CRM，可选 |
| `vendor_name` | varchar(128) | 供应商名称 | CRM，可选 |
| `contract_name` | varchar(255) | 合同名称 | CRM，可选 |
| `account_manager_name` | varchar(64) | 客户经理 | CRM，可选 |
| `payload_json` | longtext | CRM 原始数据 JSON，用于追溯 | CRM，建议填写 |
| `process_status` | varchar(32) | 同步处理状态 | CRM 初始写入，后端维护 |
| `retry_count` | int | 已重试次数 | CRM 初始写入，后端维护 |
| `enterprise_id` | bigint | 后端关联的企业 ID | 后端 |
| `enterprise_name` | varchar(255) | 后端关联的企业名称 | 后端 |
| `import_result_json` | longtext | 企业导入结果 | 后端 |
| `failure_reason` | varchar(1000) | 失败原因 | 后端 |
| `last_processed_at` | datetime | 最近处理时间 | 后端 |
| `created_at` / `updated_at` | datetime | 创建和更新时间 | 后端或数据库默认值 |

### 2.3 索引

- `source_request_id`：唯一索引，防止 CRM 重复投递。
- `contract_no`、`company_name`、`enterprise_id`、`process_status`：普通索引，支持关联、查询和轮询。

## 3. 表二：执行单同步记录

表名：`biz_crm_execution_order_sync_record`

### 3.1 用途

该表接收 CRM 执行单。后端解析 `execution_order_name`，识别国家高新技术企业、科技型中小企业等项目；随后关联企业、创建客户端申报，并绑定对应项目的已发布方案。

该表也不是正式执行单业务表，而是同步入口和处理审计记录。

### 3.2 字段说明

| 字段 | 类型 | 说明 | 维护方 |
| --- | --- | --- | --- |
| `id` | bigint | 主键 | 后端 |
| `source_request_id` | varchar(128) | CRM 唯一请求号，表内唯一 | CRM，必填 |
| 【本次变更】`source_record_id` | varchar(128) | CRM 侧执行单业务主键，修改/作废同一执行单时保持不变 | CRM，建议填写 |
| 【本次变更】`source_updated_at` | datetime | CRM 侧业务最后更新时间 | CRM，修改/作废时建议填写 |
| 【本次变更】`source_version` | varchar(64) | CRM 侧业务版本号 | CRM，可选 |
| 【本次变更】`event_type` | varchar(32) | 事件类型：`created` / `updated` / `cancelled` | CRM，可选，默认 `created` |
| `order_no` | varchar(128) | 执行单号 | CRM，必填 |
| `company_name` | varchar(255) | 客户企业名称 | CRM，必填 |
| `contract_no` | varchar(128) | 关联合同号 | CRM，建议填写 |
| `contract_review_status` | varchar(64) | 合同审核状态 | CRM，可选 |
| `execution_order_name` | varchar(500) | 执行单名称，后端据此识别申报项目 | CRM，必填 |
| `is_carried_forward` | varchar(32) | 是否结转 | CRM，可选 |
| `execution_department` | varchar(128) | 执行部门 | CRM，可选 |
| `account_manager_name` | varchar(64) | 客户经理 | CRM，可选 |
| `product_manager_name` | varchar(64) | 产品经理 | CRM，可选 |
| `payload_json` | longtext | CRM 原始数据 JSON，用于追溯 | CRM，建议填写 |
| `process_status` | varchar(32) | 同步处理状态 | CRM 初始写入，后端维护 |
| `retry_count` | int | 已重试次数 | CRM 初始写入，后端维护 |
| `enterprise_id` / `enterprise_name` | bigint / varchar(255) | 后端关联企业 | 后端 |
| `recognized_project_codes` | varchar(255) | 识别出的项目编码 | 后端 |
| `intellectual_property_count` | int | 从执行单名称识别出的知识产权数量 | 后端 |
| `declaration_ids_json` | longtext | 创建出的申报 ID 映射 | 后端 |
| `failure_reason` | varchar(1000) | 失败原因 | 后端 |
| `last_processed_at` | datetime | 最近处理时间 | 后端 |
| `created_at` / `updated_at` | datetime | 创建和更新时间 | 后端或数据库默认值 |

### 3.3 索引

- `source_request_id`：唯一索引，防止重复投递。
- `order_no`、`company_name`、`contract_no`、`enterprise_id`、`process_status`：普通索引，支持查询和轮询。

## 4. 两张表的关联

```text
合同同步记录
  contract_no + company_name
          |
          v
执行单同步记录
  contract_no + execution_order_name
          |
          v
识别申报项目
          |
          v
创建申报并绑定已发布方案
```

执行单优先通过 `contract_no` 查找已成功处理的合同记录并取得企业信息；未找到时，后端会按 `company_name` 尝试导入或关联企业。

## 5. 状态与重试

| 状态 | 含义 | 后续处理 |
| --- | --- | --- |
| `received` | CRM 已写入，等待后端处理 | 轮询首次处理 |
| `processing` | 后端正在处理 | 超过配置时长后视为超时 |
| `success` | 已成功关联企业或创建申报 | 不再自动处理 |
| `failed` | 处理失败 | 未达到重试上限时自动重试；超限后人工处理 |
| `skipped` | 已跳过 | 不再自动处理；【本次变更】也可能表示当前事件已被同一业务键的更新版本覆盖 |

`skipped` 通常出现在执行单表，例如 `execution_order_name` 中未识别到受支持的申报项目；【本次变更】旧版本和 `cancelled` 事件也会使用该状态，具体查看 `failure_reason`。

## 6. CRM 写入规则

### 6.1 CRM 应写入的字段

```text
业务基础字段
source_request_id
source_record_id
source_updated_at
source_version
event_type
company_name
contract_no / order_no
execution_order_name
payload_json

初始同步字段
process_status = received
retry_count = 0
```

### 6.2 后端专属字段

CRM 不应修改以下字段：

```text
enterprise_id
enterprise_name
import_result_json
recognized_project_codes
intellectual_property_count
declaration_ids_json
failure_reason
last_processed_at
process_status（处理过程中）
retry_count（重试过程中）
```

即使数据库账号有 `UPDATE` 权限，CRM 也不应修改这些字段，否则会影响轮询、重试、申报创建和失败追踪。

### 6.3 合同插入示例

```sql
INSERT INTO biz_crm_contract_sync_record (
  source_request_id, company_name, contract_no, contract_name,
  payload_json, process_status, retry_count, created_at, updated_at
) VALUES (
  'crm-contract-10001', '某某科技有限公司', 'HT-2026-001', '高企服务合同',
  '{"sourceRequestId":"crm-contract-10001"}',
  'received', 0, NOW(), NOW()
);
```

### 6.4 执行单插入示例

```sql
INSERT INTO biz_crm_execution_order_sync_record (
  source_request_id, order_no, company_name, contract_no,
  execution_order_name, payload_json, process_status,
  retry_count, created_at, updated_at
) VALUES (
  'crm-exec-10001', 'EXEC-2026-001', '某某科技有限公司', 'HT-2026-001',
  '2026年国家高新技术企业申报，15件知识产权',
  '{"sourceRequestId":"crm-exec-10001"}',
  'received', 0, NOW(), NOW()
);
```

CRM 应使用参数化 SQL，禁止通过字符串拼接组装 SQL。

## 7. 数据库账号权限

推荐最小权限是只允许向两张同步入口表插入数据。

```sql
GRANT INSERT ON `new_kjqb`.`biz_crm_contract_sync_record`
TO 'crm_sync'@'%';

GRANT INSERT ON `new_kjqb`.`biz_crm_execution_order_sync_record`
TO 'crm_sync'@'%';
```

如果 CRM 确实需要查询或更新自己的业务字段，可以使用：

```sql
GRANT SELECT, INSERT, UPDATE
ON `new_kjqb`.`biz_crm_contract_sync_record`
TO 'crm_sync'@'%';

GRANT SELECT, INSERT, UPDATE
ON `new_kjqb`.`biz_crm_execution_order_sync_record`
TO 'crm_sync'@'%';
```

`'crm_sync'@'%'` 表示允许所有来源 IP 连接。此配置必须配合复杂密码、服务器防火墙、云安全组和可用时的 TLS；生产环境更建议将 `%` 替换为明确的 CRM 出口 IP。

不应授予以下权限：

```text
DELETE
ALTER
CREATE
DROP
INDEX
REFERENCES
TRIGGER
```

验证用户权限：

```sql
SHOW GRANTS FOR 'crm_sync'@'%';
```

结果中应只出现两张目标表，不应出现 `ON new_kjqb.*` 或 `ON *.*`。

## 8. 轮询配置

后端 `backend/.env` 使用以下配置：

```dotenv
CRM_SYNC_POLL_ENABLED=1
CRM_SYNC_POLL_INTERVAL_MS=30000
CRM_SYNC_BATCH_SIZE=20
CRM_SYNC_MAX_RETRY=3
CRM_SYNC_PROCESSING_TIMEOUT_MS=900000
```

| 配置 | 说明 |
| --- | --- |
| `CRM_SYNC_POLL_ENABLED` | `1` 开启自动轮询，`0` 关闭 |
| `CRM_SYNC_POLL_INTERVAL_MS` | 轮询间隔，单位毫秒；`30000` 为 30 秒 |
| `CRM_SYNC_BATCH_SIZE` | 每种记录类型每轮最多处理数量；`20` 即合同最多 20 条、执行单最多 20 条 |
| `CRM_SYNC_MAX_RETRY` | 首次失败后的最大自动重试次数 |
| `CRM_SYNC_PROCESSING_TIMEOUT_MS` | `processing` 超时阈值，单位毫秒；`900000` 为 15 分钟 |

修改 `.env` 后需要重启后端服务。

## 9. 【本次变更】CRM 事件写入示例

CRM 不应直接修改入口表历史记录。以执行单修改为例，每次修改追加一条新记录：

```sql
INSERT INTO biz_crm_execution_order_sync_record (
  source_request_id,
  source_record_id,
  source_updated_at,
  source_version,
  event_type,
  order_no,
  company_name,
  execution_order_name,
  payload_json,
  process_status
) VALUES (
  'crm-order-20260804-002',
  'crm-execution-order-20001',
  '2026-08-04 10:30:00',
  '2',
  'updated',
  'E47864',
  '示例科技有限公司',
  '2026 年国家高新技术企业申报资料整理，15 件知识产权',
  '{"sourceRequestId":"crm-order-20260804-002"}',
  'received'
);
```

作废时只需将 `event_type` 改为 `cancelled`，仍使用新的 `source_request_id`，并保持相同 `source_record_id`。CRM 数据库账号只允许向入口表写入，不应修改 `process_status`、`failure_reason`、`enterprise_id`、`declaration_ids_json` 等后端维护字段。

## 10. 【本次变更】变更记录

| 日期 | 变更内容 |
| --- | --- |
| 2026-08-04 | 增加业务键、更新时间、版本号、事件类型字段；明确修改/作废采用新请求号追加写入；补充旧版本跳过、作废处理和 SQL 写入示例。 |
