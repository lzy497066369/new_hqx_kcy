# CRM 同步接口文档

本文档对应当前已部署的 CRM 同步模块。CRM 只需要调用两个外部接口：合同同步、执行单同步。后台查询、详情和人工重试页面由本系统管理员使用，不对 CRM 开放。

> **【本次变更 | 2026-08-04】** 本版增加 CRM 业务变更事件支持。CRM 修改或作废业务单据时，必须使用新的 `sourceRequestId`，并携带 `sourceRecordId`、`sourceUpdatedAt`、`sourceVersion`、`eventType`。正文中新增或调整内容统一使用 `【本次变更】` 标记。

## 1. 接入信息

| 项目 | 说明 |
| --- | --- |
| 基础地址 | `https://{后端域名}`，由实施方提供；本地默认 `http://127.0.0.1:3000` |
| 数据格式 | 请求和响应均为 `application/json; charset=utf-8` |
| 鉴权请求头 | `X-Crm-Token: {CRM_SYNC_TOKEN}` |
| 调用方式 | `POST`，接口会在当前请求中完成企业导入和申报创建后再返回 |
| 字符编码 | UTF-8 |

`CRM_SYNC_TOKEN` 由双方线下配置，不能写入 CRM 前端、截图、日志或文档示例。令牌缺失或错误时接口返回 HTTP `401`。

## 2. 通用规则

### 2.1 统一响应结构

所有接口均返回以下结构：

```json
{
  "code": 0,
  "message": "成功",
  "data": {}
}
```

- HTTP `2xx` 且 `code: 0`：请求已被系统接收。CRM **还必须检查** `data.processStatus`，确认业务处理是否成功。
- HTTP `4xx` / `5xx`：请求未被正常接收或鉴权、参数校验失败；`data` 为 `null`，`code` 等于 HTTP 状态码。
- 企业查询、企业导入、政策项目未配置等处理异常会被保存到同步记录中，此时 HTTP 仍为 `200`、`code` 为 `0`，但 `data.processStatus` 为 `failed`，具体原因见 `data.failureReason`。

示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "101",
    "sourceRequestId": "crm-contract-20260722-001",
    "processStatus": "success",
    "failureReason": null,
    "duplicate": false
  }
}
```

### 2.2 幂等与重发

> **【本次变更】** 本节补充“同一业务单据多次变更”的追加式事件规则。

`sourceRequestId` 是两个接口各自的唯一幂等键，最长 `128` 个字符。

- 同一个接口中，相同 `sourceRequestId` 只会创建一条同步记录。
- 因网络超时等原因重发时，必须使用原来的 `sourceRequestId`；系统返回原记录，`duplicate` 为 `true`，不会重复创建企业或申报。
- 相同 `sourceRequestId` 并发到达时，系统也会安全返回其中已落库的记录，不会因数据库唯一键冲突导致接口异常。
- 【本次变更】已发送成功后需要更正业务字段时，必须使用新的 `sourceRequestId`，不能复用旧幂等键。新事件不会覆盖旧同步记录，旧记录保留用于审计和追溯。
- 【本次变更】同一业务单据的修改/作废事件必须保持相同的 `sourceRecordId`；`sourceUpdatedAt` 或 `sourceVersion` 应比上一事件更新。
- 当记录正在处理时，重复请求会返回当前记录。管理员可在后台查看状态；异常中断超过 15 分钟后可人工重新执行。

### 2.3 【本次变更】业务变更事件规则

CRM 入口表采用追加式事件，不对已写入的同步记录执行 `UPDATE`。同一合同或执行单发生变化时，CRM 每次都新增一条请求记录：

| 场景 | `sourceRequestId` | `sourceRecordId` | `eventType` | 处理规则 |
| --- | --- | --- | --- | --- |
| 首次同步 | 新值 | 新的 CRM 业务主键 | `created`，可省略 | 正常处理 |
| 修改同步 | 新值 | 与原单据相同 | `updated` | 按业务键和版本处理最新事件 |
| 作废同步 | 新值 | 与原单据相同 | `cancelled` | 保留审计记录，标记为 `skipped`，不直接删除或修改正式业务数据 |

字段优先级：合同优先使用 `sourceRecordId`，未提供时使用 `contractNo`；执行单优先使用 `sourceRecordId`，未提供时使用 `orderNo`。当同一业务键已有更新的 `sourceUpdatedAt` 或 `sourceVersion` 时，较旧事件会标记为 `skipped`。

注意：新接入建议至少提供 `sourceUpdatedAt` 或 `sourceVersion` 一个，最好两个都提供；两个字段都省略时，为兼容历史数据，后端不会启用版本比较。`sourceUpdatedAt` 使用可被 JavaScript `Date` 解析的时间字符串，例如 `2026-08-04T10:30:00+08:00`；所有新增字段仍必须传字符串。

### 2.4 处理状态

| `processStatus` | 含义 | CRM 建议处理 |
| --- | --- | --- |
| `received` | 已保存，尚未开始处理 | 短暂状态，稍后按相同幂等键查询或由管理员查看 |
| `processing` | 正在处理 | 不要创建新的幂等键重复提交 |
| `success` | 企业导入或申报创建已完成 | 处理完成 |
| `skipped` | 已保存，但执行单名称未识别为高企或科小 | 无需重发；由业务确认名称是否符合规则 |
| `failed` | 已保存，但处理失败 | 查看 `failureReason`；管理员可在后台重新执行 |

## 3. 合同同步

### 3.1 接口

`POST /integration/crm/contracts`

合同数据只写入 CRM 合同同步记录，**不会写入企业合同台账**。系统会按公司名称调用天眼查企业搜索与导入能力，自动创建或更新企业资料，但固定不创建企业账号。

### 3.2 请求头

```http
Content-Type: application/json
X-Crm-Token: {CRM_SYNC_TOKEN}
```

### 3.3 请求字段

| 字段 | 类型 | 必填 | 最大长度 | CRM 对应字段 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `sourceRequestId` | string | 是 | 128 | CRM 推送唯一标识 | 幂等键；每次新增/修改/作废事件都必须生成新值 |
| 【本次变更】`sourceRecordId` | string | 否 | 128 | CRM 合同业务主键 | 同一合同的多个事件保持不变；建议必传 |
| 【本次变更】`sourceUpdatedAt` | string | 否 | 40 | CRM 业务最后更新时间 | 用于新旧事件比较；建议必传 |
| 【本次变更】`sourceVersion` | string | 否 | 64 | CRM 业务版本号 | 用于新旧事件比较；建议使用递增数字或稳定版本号 |
| 【本次变更】`eventType` | string | 否 | 32 | CRM 事件类型 | `created` / `updated` / `cancelled`；省略时默认为 `created` |
| `companyName` | string | 是 | 255 | 公司名称 / 客户名称 | 用于天眼查精确匹配；不能为空白 |
| `sequenceNo` | string | 否 | 64 | 序号 | 原样保存 |
| `contractNo` | string | 否 | 128 | 合同号 | 原样保存，执行单可用其关联已导入企业 |
| `customerContractNo` | string | 否 | 128 | 客户合同编号 / PO | 原样保存 |
| `vendorName` | string | 否 | 128 | 厂商 | 原样保存 |
| `contractName` | string | 否 | 255 | 合同单名称 | 原样保存 |
| `accountManagerName` | string | 否 | 64 | 客户经理 | 原样保存 |

所有字段均为字符串；不需要传的可省略，不要传数值、对象或数组。

### 3.4 请求示例

```bash
curl -X POST 'https://{后端域名}/integration/crm/contracts' \
  -H 'Content-Type: application/json' \
  -H 'X-Crm-Token: {CRM_SYNC_TOKEN}' \
  -d '{
    "sourceRequestId": "crm-contract-20260722-001",
    "sourceRecordId": "crm-contract-10001",
    "sourceUpdatedAt": "2026-08-04T10:30:00+08:00",
    "sourceVersion": "2",
    "eventType": "updated",
    "companyName": "示例科技有限公司",
    "sequenceNo": "1",
    "contractNo": "H12381",
    "customerContractNo": "PO-001",
    "vendorName": "厂商名称",
    "contractName": "2026 年高企服务合同",
    "accountManagerName": "张三"
  }'
```

### 3.5 成功响应示例

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "101",
    "sourceRequestId": "crm-contract-20260722-001",
    "sourceRecordId": "crm-contract-10001",
    "sourceUpdatedAt": "2026-08-04T10:30:00.000Z",
    "sourceVersion": "2",
    "eventType": "updated",
    "sequenceNo": "1",
    "contractNo": "H12381",
    "customerContractNo": "PO-001",
    "vendorName": "厂商名称",
    "contractName": "2026 年高企服务合同",
    "accountManagerName": "张三",
    "companyName": "示例科技有限公司",
    "enterpriseId": "88",
    "enterpriseName": "示例科技有限公司",
    "processStatus": "success",
    "failureReason": null,
    "retryCount": 0,
    "lastProcessedAt": "2026-07-22T04:00:00.000Z",
    "duplicate": false,
    "createdAt": "2026-07-22T04:00:00.000Z",
    "updatedAt": "2026-07-22T04:00:00.000Z"
  }
}
```

### 3.6 业务失败响应示例

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "101",
    "sourceRequestId": "crm-contract-20260722-001",
    "companyName": "示例科技有限公司",
    "enterpriseId": null,
    "enterpriseName": null,
    "processStatus": "failed",
    "failureReason": "天眼查未找到与 CRM 客户名称完全一致的企业",
    "retryCount": 0,
    "duplicate": false
  }
}
```

## 4. 执行单同步

### 4.1 接口

`POST /integration/crm/execution-orders`

执行单会先完整保存原始请求，再从 `executionOrderName` 识别申报类型和知识产权数量。命中规则后自动创建草稿申报：

| 名称识别结果 | 创建的政策项目代码 | 创建结果 |
| --- | --- | --- |
| 国家高新技术企业、高新技术企业申报或高企申报 | `QUAL_HIGH_TECH_ENTERPRISE_NATIONAL` | 国家高新技术企业申报草稿 |
| 科小入库、科小申报或科技型中小企业 | `QUAL_TECH_SME_PROVINCIAL` | 省级科技型中小企业申报草稿 |

- 一个名称同时命中高企和科小时，会各创建一个申报草稿。
- 名称未命中上述项目时，记录状态为 `skipped`，不创建企业和申报。
- 知识产权数量可识别如 `知识产权15件`、`知识产权数量：15项`、`15个知识产权`，结果写入 `intellectualPropertyCount`。
- 创建申报前优先按已成功同步的相同 `contractNo` 复用企业；没有可用合同记录时，按 `companyName` 调用天眼查导入企业。
- 对同一企业、同一政策项目已有有效申报（草稿、准备中、审核中、已提交或已驳回）时，复用原申报，不重复创建。

### 4.2 请求字段

| 字段 | 类型 | 必填 | 最大长度 | CRM 对应字段 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `sourceRequestId` | string | 是 | 128 | CRM 推送唯一标识 | 幂等键；每次新增/修改/作废事件都必须生成新值 |
| 【本次变更】`sourceRecordId` | string | 否 | 128 | CRM 执行单业务主键 | 同一执行单的多个事件保持不变；建议必传 |
| 【本次变更】`sourceUpdatedAt` | string | 否 | 40 | CRM 业务最后更新时间 | 用于新旧事件比较；建议必传 |
| 【本次变更】`sourceVersion` | string | 否 | 64 | CRM 业务版本号 | 用于新旧事件比较；建议使用递增数字或稳定版本号 |
| 【本次变更】`eventType` | string | 否 | 32 | CRM 事件类型 | `created` / `updated` / `cancelled`；省略时默认为 `created` |
| `orderNo` | string | 是 | 128 | 单号 | 不能为空白 |
| `companyName` | string | 是 | 255 | 客户 | 用于企业匹配，不能为空白 |
| `executionOrderName` | string | 是 | 500 | 项目执行单名称 | 用于识别项目类型和知识产权数量，不能为空白 |
| `contractNo` | string | 否 | 128 | 合同号 | 用于复用合同同步得到的企业 |
| `contractReviewStatus` | string | 否 | 64 | 合同审核状态 | 原样保存，不作为拦截条件 |
| `isCarriedForward` | string | 否 | 32 | 是否结转 | 原样保存，例如 `是` / `否` |
| `executionDepartment` | string | 否 | 128 | 执行部门 | 原样保存 |
| `accountManagerName` | string | 否 | 64 | 客户经理 | 原样保存 |
| `productManagerName` | string | 否 | 64 | 产品经理 | 原样保存 |

### 4.3 请求示例

```bash
curl -X POST 'https://{后端域名}/integration/crm/execution-orders' \
  -H 'Content-Type: application/json' \
  -H 'X-Crm-Token: {CRM_SYNC_TOKEN}' \
  -d '{
    "sourceRequestId": "crm-order-20260722-001",
    "sourceRecordId": "crm-execution-order-20001",
    "sourceUpdatedAt": "2026-08-04T10:30:00+08:00",
    "sourceVersion": "2",
    "eventType": "updated",
    "orderNo": "E47864",
    "companyName": "示例科技有限公司",
    "contractNo": "H12381",
    "contractReviewStatus": "已审核",
    "executionOrderName": "2026 年国家高新技术企业申报资料整理，15 件知识产权",
    "isCarriedForward": "否",
    "executionDepartment": "PG-Other|其他",
    "accountManagerName": "张三",
    "productManagerName": "李四"
  }'
```

### 4.4 成功响应示例

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "201",
    "sourceRequestId": "crm-order-20260722-001",
    "sourceRecordId": "crm-execution-order-20001",
    "sourceUpdatedAt": "2026-08-04T10:30:00.000Z",
    "sourceVersion": "2",
    "eventType": "updated",
    "orderNo": "E47864",
    "companyName": "示例科技有限公司",
    "contractNo": "H12381",
    "executionOrderName": "2026 年国家高新技术企业申报资料整理，15 件知识产权",
    "enterpriseId": "88",
    "enterpriseName": "示例科技有限公司",
    "projectCodes": ["QUAL_HIGH_TECH_ENTERPRISE_NATIONAL"],
    "intellectualPropertyCount": 15,
    "declarationIds": {
      "QUAL_HIGH_TECH_ENTERPRISE_NATIONAL": "301"
    },
    "processStatus": "success",
    "failureReason": null,
    "retryCount": 0,
    "duplicate": false,
    "lastProcessedAt": "2026-07-22T04:00:00.000Z",
    "createdAt": "2026-07-22T04:00:00.000Z",
    "updatedAt": "2026-07-22T04:00:00.000Z"
  }
}
```

### 4.5 未识别项目响应示例

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "202",
    "sourceRequestId": "crm-order-20260722-002",
    "orderNo": "E47865",
    "companyName": "示例科技有限公司",
    "projectCodes": [],
    "intellectualPropertyCount": null,
    "declarationIds": {},
    "processStatus": "skipped",
    "failureReason": "项目执行单名称未识别到高企或科小申报",
    "duplicate": false
  }
}
```

## 5. 错误响应与处理建议

### 5.1 鉴权失败

```json
{
  "code": 401,
  "message": "CRM 接口令牌无效",
  "data": null
}
```

检查 `X-Crm-Token` 是否已配置、是否使用正确的环境令牌。不要在 CRM 侧无限重试 401。

### 5.2 参数校验失败

```json
{
  "code": 400,
  "message": "sourceRequestId must be shorter than or equal to 128 characters",
  "data": null
}
```

校验失败后，修正数据再以新的或原幂等键发送。必填字段为空白时会返回中文提示，例如 `companyName 不能为空`。

### 5.3 服务配置或内部错误

```json
{
  "code": 500,
  "message": "服务器内部错误",
  "data": null
}
```

CRM 应保留原 `sourceRequestId`，采用有限次数的退避重试；持续失败时联系系统管理员。若返回 `200` 但 `processStatus: "failed"`，则不应重新生成幂等键，管理员可在后台查看记录与失败原因后重新执行。

### 5.4 【本次变更】旧版本与作废事件响应

旧版本或作废事件会正常返回 HTTP `200`，但 `data.processStatus` 为 `skipped`：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "103",
    "sourceRequestId": "crm-contract-20260804-003",
    "sourceRecordId": "crm-contract-10001",
    "sourceVersion": "1",
    "eventType": "updated",
    "processStatus": "skipped",
    "failureReason": "CRM 已存在更新版本事件，当前记录已跳过",
    "duplicate": false
  }
}
```

CRM 收到 `skipped` 后不要生成新的随机请求号重试；先检查 `sourceUpdatedAt/sourceVersion` 是否过旧，或联系系统管理员确认。

## 6. CRM 对接检查清单

- 每次新增或变更业务记录时生成稳定、唯一的 `sourceRequestId`。
- 【本次变更】同一业务单据的修改/作废事件保持相同的 `sourceRecordId`，每次事件使用新的 `sourceRequestId`。
- 【本次变更】修改/作废事件传 `sourceUpdatedAt`、`sourceVersion` 和 `eventType`；作废使用 `eventType: "cancelled"`。
- 设置 `Content-Type: application/json` 和 `X-Crm-Token`。
- 不传 `null`、数值、对象或数组给字符串字段；可选字段直接省略。
- 接收 HTTP `200` 后检查 `code === 0` 和 `data.processStatus`，不要只判断 HTTP 状态码。
- 网络超时或收到 `5xx` 时，以相同 `sourceRequestId` 退避重发。
- 收到 `failed` 或 `skipped` 时记录 `id`、`sourceRequestId`、`failureReason`，供业务和后台人员定位。
- 上线前确认系统已配置 `CRM_SYNC_TOKEN`、天眼查令牌和两个已启用政策项目：国家高新技术企业、省级科技型中小企业。

## 7. 【本次变更】变更记录

| 日期 | 变更内容 |
| --- | --- |
| 2026-08-04 | 增加 `sourceRecordId`、`sourceUpdatedAt`、`sourceVersion`、`eventType` 字段；明确修改/作废必须使用新的 `sourceRequestId`；增加旧版本 `skipped` 规则和请求/响应示例。 |
