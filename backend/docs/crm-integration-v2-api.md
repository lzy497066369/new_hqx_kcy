# CRM v2 安全接口文档

CRM v2 使用每个调用方独立的 `App ID + Key ID + HMAC-SHA256` 签名，不使用可长期重放的静态 `X-Crm-Token`。v1 接口保留为短期兼容入口，新的 CRM 对接必须使用 v2。

> **【本次变更 | 2026-08-04】** 本版增加 CRM 业务变更事件支持。CRM 修改或作废业务单据时，必须使用新的 `sourceRequestId`，并携带 `sourceRecordId`、`sourceUpdatedAt`、`sourceVersion`、`eventType`。正文中新增或调整内容统一使用 `【本次变更】` 标记。

## 1. 上线前配置

1. 后端环境变量设置 `CRM_INTEGRATION_ENCRYPTION_KEY`。它必须是 32 字节随机值的 Base64URL 编码，用于加密数据库内的签名密钥。
2. 执行数据库迁移 `20260723_01_crm_integration_v2`；【本次变更】如已有 CRM 同步表，还需执行 `20260804_01_crm_sync_event_version`。
3. 管理员进入“CRM同步 -> 安全集成”，创建调用方并配置 IP 白名单与每分钟限流。
4. 为调用方创建签名密钥。系统只显示一次 `Secret`；CRM 必须安全保存 `App ID`、`Key ID`、`Secret`。

生成根加密密钥示例：

```powershell
$bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
```

不要随意替换根加密密钥。替换后旧密钥将无法解密，除非先完成密钥迁移。

## 2. 接口

| 用途 | 方法 | 地址 |
| --- | --- | --- |
| 合同入站 | `POST` | `/integration/v2/crm/contracts` |
| 执行单入站 | `POST` | `/integration/v2/crm/execution-orders` |
| 查询处理状态 | `GET` | `/integration/v2/crm/requests/{sourceRequestId}?type=contract` |

执行单查询时将 `type` 改为 `execution_order`。

所有 v2 接口必须使用 HTTPS、`Content-Type: application/json` 和下列签名请求头：

```http
X-Crm-App-Id: crm_main
X-Crm-Key-Id: key_202607
X-Crm-Timestamp: 1784692800
X-Crm-Nonce: 6e227066-10db-4f99-9e0d-2078a6638074
X-Crm-Body-Sha256: 5d41402abc4b2a76b9719d911017c592...
X-Crm-Signature: Base64URL_HMAC_SHA256
```

| 请求头 | 规则 |
| --- | --- |
| `X-Crm-App-Id` | 后台创建的调用方标识 |
| `X-Crm-Key-Id` | 后台创建的密钥标识 |
| `X-Crm-Timestamp` | 当前 Unix 秒级时间戳；与服务端误差不得超过 5 分钟 |
| `X-Crm-Nonce` | 每次请求生成的新随机字符串，长度 16-128；十分钟内不可重复 |
| `X-Crm-Body-Sha256` | 原始 HTTP 请求体字节的 SHA-256 小写十六进制值；GET 空请求体也要计算 |
| `X-Crm-Signature` | 对规范请求的 HMAC-SHA256，Base64URL 编码 |

## 3. 签名算法

规范请求内容必须完全按下列顺序、使用换行符 `\n` 拼接：

```text
HTTP_METHOD
PATH_AND_QUERY
TIMESTAMP
NONCE
BODY_SHA256
```

合同示例：

```text
POST
/integration/v2/crm/contracts
1784692800
6e227066-10db-4f99-9e0d-2078a6638074
{请求原文 SHA-256}
```

状态查询示例：

```text
GET
/integration/v2/crm/requests/crm-contract-1001?type=contract
1784692800
{新的 nonce}
{空请求体 SHA-256}
```

签名计算：

```text
signature = Base64URL(HMAC-SHA256(Secret, canonicalRequest))
```

Node.js 示例：

```js
import crypto from 'node:crypto';

const body = JSON.stringify({
  sourceRequestId: 'crm-contract-1001',
  companyName: '示例科技有限公司',
});
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = crypto.randomUUID();
const path = '/integration/v2/crm/contracts';
const bodyHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
const canonical = ['POST', path, timestamp, nonce, bodyHash].join('\n');
const signature = crypto.createHmac('sha256', process.env.CRM_SECRET)
  .update(canonical, 'utf8')
  .digest('base64url');
```

签名必须基于最终发送的原始 JSON 字节计算。不要在签名后格式化 JSON、修改字段顺序或改写空格。

## 4. 幂等与异步状态

每个调用方、每种请求类型中，`sourceRequestId` 唯一。

- 相同 `sourceRequestId` 和相同请求体：返回已有请求状态，`duplicate: true`，不重复创建企业或申报。
- 相同 `sourceRequestId` 但请求体摘要不同：返回 `409`，不接受静默覆盖。
- 网络重试必须使用原 `sourceRequestId`，但每次都要生成新的 `nonce`、`timestamp` 和签名。
- v2 请求验签后返回 HTTP `202`。企业导入和申报创建在后台异步完成。

### 4.1 【本次变更】业务修改与作废

CRM v2 的签名幂等和业务事件版本是两套规则：

- `sourceRequestId` 用于识别一次 HTTP 入站请求；同一请求重试必须复用它。
- 同一合同或执行单发生修改/作废时，必须生成新的 `sourceRequestId`，不能用旧值覆盖原请求。
- 同一业务单据的多个事件必须使用相同的 `sourceRecordId`。合同没有 `sourceRecordId` 时，后端退回使用 `contractNo`；执行单没有 `sourceRecordId` 时，后端退回使用 `orderNo`。
- 新接入建议传 `sourceUpdatedAt` 或 `sourceVersion` 至少一个，最好两个都传；两个字段都省略时，为兼容历史数据，后端不会启用版本比较。新事件的时间或版本不应早于上一事件。
- `eventType` 可取 `created`、`updated`、`cancelled`，省略时默认为 `created`。
- 旧版本事件会进入入站记录，但最终状态为 `skipped`；`cancelled` 事件同样只保留审计记录，不直接删除企业、申报或其他正式业务数据。

事件示例：

```json
{
  "sourceRequestId": "crm-order-20260804-002",
  "sourceRecordId": "crm-execution-order-20001",
  "sourceUpdatedAt": "2026-08-04T10:30:00+08:00",
  "sourceVersion": "2",
  "eventType": "updated",
  "orderNo": "E47864",
  "companyName": "示例科技有限公司",
  "executionOrderName": "2026 年国家高新技术企业申报资料整理，15 件知识产权"
}
```

所有新增字段均为字符串，`sourceUpdatedAt` 建议使用 ISO 8601 时间字符串。事件记录采用追加方式，CRM 不应直接 `UPDATE` 或 `DELETE` 本系统的同步表记录。

接收响应：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "901",
    "sourceRequestId": "crm-contract-1001",
    "requestType": "contract",
    "processStatus": "accepted",
    "duplicate": false
  }
}
```

状态为 `accepted`、`processing`、`success`、`failed`、`skipped`。CRM 应通过状态查询接口确认最终结果。

### 4.2 【本次变更】旧版本状态查询示例

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": "902",
    "sourceRequestId": "crm-order-20260804-001",
    "requestType": "execution_order",
    "processStatus": "skipped",
    "failureReason": "CRM 已存在更新版本事件，当前记录已跳过",
    "duplicate": false
  }
}
```

收到 `skipped` 时，不要用新的随机请求号重复发送同一旧版本数据；应检查 CRM 的业务版本和更新时间。

## 5. 防护与错误码

- 调用方可配置精确 IP 或 IPv4 CIDR，例如 `10.0.0.0/24,203.0.113.8`；未配置时不限制来源 IP。
- 每个调用方默认每分钟最多 60 个已验签入站请求，可在后台调整。
- 请求体限制为 64 KiB；未知字段、非字符串字段和超长字段直接拒绝。
- nonce 使用数据库唯一约束保存十分钟，支持多实例部署下的防重放；过期记录自动清理。
- 密钥只以 AES-256-GCM 密文写入数据库，创建后明文 Secret 仅在后台显示一次。

| HTTP 状态 | 含义 |
| --- | --- |
| `400` | 报文、字段、时间戳或摘要格式错误 |
| `401` | App ID、Key ID、签名或时间窗口无效 |
| `403` | 来源 IP 或密钥权限未获授权 |
| `409` | nonce 已使用，或同一幂等键请求内容不一致 |
| `429` | 调用频率超限 |
| `503` | 服务端缺少根加密密钥配置 |

接口日志不保存 Secret 或 Signature 明文。密钥轮换时先创建新 Key，CRM 切换成功后再停用旧 Key。

## 6. 【本次变更】请求字段补充

合同入站和执行单入站都支持以下业务事件字段：

| 字段 | 类型 | 必填 | 最大长度 | 说明 |
| --- | --- | --- | --- | --- |
| `sourceRecordId` | string | 否 | 128 | CRM 侧稳定业务主键；同一业务单据的多个事件必须保持不变，建议必传 |
| `sourceUpdatedAt` | string | 否 | 40 | CRM 侧业务最后更新时间；建议使用 ISO 8601 格式 |
| `sourceVersion` | string | 否 | 64 | CRM 侧业务版本号；建议使用递增数字或稳定版本号 |
| `eventType` | string | 否 | 32 | `created` / `updated` / `cancelled`；省略时默认为 `created` |

原有合同字段和执行单字段保持不变，详见 v1 字段定义。v2 额外要求请求体只使用文档允许字段，未知字段仍会返回 `400`。

## 7. 【本次变更】变更记录

| 日期 | 变更内容 |
| --- | --- |
| 2026-08-04 | 增加 `sourceRecordId`、`sourceUpdatedAt`、`sourceVersion`、`eventType` 字段；明确修改/作废必须使用新的 `sourceRequestId`；补充 v2 异步状态、旧版本跳过和数据库迁移说明。 |
