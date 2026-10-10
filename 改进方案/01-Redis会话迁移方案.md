# Redis 会话迁移方案

> 优先级：P0  
> 预计工期：3 天开发 + 2 天测试  
> 风险等级：高  
> 负责人：后端 Lead

## 一、问题描述

### 当前架构
```
┌─────────────┐
│ NestJS App  │
│             │
│ ┌─────────┐ │
│ │ Memory  │ │  ← 会话数据存储在进程内存
│ │ Session │ │
│ └─────────┘ │
└─────────────┘

问题：
1. 单实例限制 - 无法水平扩展
2. 进程重启 - 所有用户被踢下线
3. 节流数据丢失 - 登录失败记录无法持久化
4. 负载均衡不可用 - 不同实例会话不共享
```

### 影响范围
- 用户会话（JWT Token 刷新）
- 登录失败节流（15 分钟 5 次限制）
- 未来的分布式锁、缓存等功能

## 二、目标架构

### 迁移后架构
```
┌─────────────┐     ┌─────────────┐
│ NestJS #1   │────→│             │
└─────────────┘     │   Redis     │
                    │  Cluster    │
┌─────────────┐     │             │
│ NestJS #2   │────→│             │
└─────────────┘     └─────────────┘
       ↑
    负载均衡

优势：
✅ 支持多实例部署
✅ 会话持久化
✅ 统一的节流和限流
✅ 为分布式功能打基础
```

## 三、技术方案

### 3.1 Redis 配置选型

**开发/测试环境**
```yaml
模式: 单机 Redis
版本: Redis 7.0+
内存: 256 MB
持久化: RDB + AOF
```

**生产环境**
```yaml
模式: Redis 主从 + Sentinel（或 Redis Cluster）
版本: Redis 7.0+
内存: 2 GB+ （按用户量评估）
持久化: RDB + AOF
备份: 每日全量备份
监控: 内存使用率、连接数、命令耗时
```

### 3.2 Session Store 实现

**方案选择：使用 connect-redis**

```typescript
// 当前代码已引入 ioredis，复用连接池
import { Redis } from 'ioredis';
import RedisStore from 'connect-redis';

// Redis 连接配置
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: Number(process.env.REDIS_SESSION_DB) || 0,
  keyPrefix: 'sess:',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

// Session Store 配置
const store = new RedisStore({
  client: redis,
  ttl: 86400 * 7, // 7 天过期
  prefix: 'hqx:session:',
});
```

### 3.3 登录节流迁移

**当前实现**：内存 Map 存储
```typescript
// 伪代码示例
private failedAttempts = new Map<string, number>();
```

**迁移后实现**：Redis 计数器
```typescript
async checkLoginThrottle(identifier: string): Promise<boolean> {
  const key = `throttle:login:${identifier}`;
  const attempts = await this.redis.incr(key);
  
  if (attempts === 1) {
    // 首次失败，设置 15 分钟过期
    await this.redis.expire(key, 900);
  }
  
  return attempts > 5;
}

async resetLoginThrottle(identifier: string): Promise<void> {
  const key = `throttle:login:${identifier}`;
  await this.redis.del(key);
}
```

### 3.4 JWT Refresh Token 存储

**当前实现**：无持久化（仅在响应中返回）
**迁移后实现**：Redis 存储 Refresh Token 白名单

```typescript
async storeRefreshToken(userId: number, token: string): Promise<void> {
  const key = `refresh_token:${userId}`;
  // 存储 7 天
  await this.redis.setex(key, 86400 * 7, token);
}

async validateRefreshToken(userId: number, token: string): Promise<boolean> {
  const key = `refresh_token:${userId}`;
  const stored = await this.redis.get(key);
  return stored === token;
}

async revokeRefreshToken(userId: number): Promise<void> {
  const key = `refresh_token:${userId}`;
  await this.redis.del(key);
}
```

## 四、实施步骤

### 第 1 天：环境准备

**上午：Redis 环境搭建**
1. 开发环境：Docker Compose 启动 Redis
   ```yaml
   # docker-compose.redis.yml
   version: '3.8'
   services:
     redis:
       image: redis:7.0-alpine
       ports:
         - "6379:6379"
       volumes:
         - redis-data:/data
       command: redis-server --appendonly yes
   volumes:
     redis-data:
   ```

2. 测试环境：云 Redis 实例申请
3. 配置环境变量
   ```bash
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_SESSION_DB=0
   ```

**下午：依赖安装与配置**
1. 安装依赖
   ```bash
   npm install connect-redis express-session
   npm install @types/express-session -D
   ```

2. 创建 Redis 模块配置
   ```
   backend/src/infrastructure/cache/
   ├── redis.module.ts          # 已存在，检查配置
   ├── redis.service.ts         # 已存在，检查接口
   └── session.config.ts        # 新建，Session 配置
   ```

### 第 2 天：代码迁移

**上午：Session Store 集成**
1. 修改 `main.ts`，集成 Redis Session
2. 配置 session 中间件
3. 保留原有认证逻辑，仅更换存储层

**下午：登录节流迁移**
1. 修改 `auth.service.ts`
2. 将 `failedAttempts` Map 替换为 Redis 调用
3. 保持接口签名不变

### 第 3 天：功能完善

**上午：Refresh Token 存储**
1. 实现 Refresh Token 白名单机制
2. 修改 `/auth/refresh` 接口
3. 实现 Token 撤销功能（用于用户登出）

**下午：监控与日志**
1. 添加 Redis 连接状态监控
2. 添加关键操作日志
3. 实现优雅降级策略（Redis 不可用时的处理）

### 第 4 天：测试

**上午：单元测试**
1. 编写 Session Store 测试用例
2. 编写登录节流测试用例
3. 编写 Refresh Token 测试用例

**下午：集成测试**
1. 多实例部署测试
2. 负载均衡会话共享测试
3. Redis 故障切换测试

### 第 5 天：灰度发布

**上午：预发布环境验证**
1. 部署到预发布环境
2. 完整业务流程验证
3. 性能压测

**下午：生产灰度**
1. 10% 流量灰度
2. 监控错误率、响应时间
3. 逐步提升到 100%

## 五、数据结构设计

### Session Key 设计
```
格式: hqx:session:{sessionId}
类型: Hash
过期: 7 天
字段:
  - userId: 用户ID
  - username: 用户名
  - appScope: 应用作用域
  - loginAt: 登录时间
  - lastAccessAt: 最后访问时间
```

### Throttle Key 设计
```
格式: hqx:throttle:login:{identifier}
类型: String (计数器)
过期: 15 分钟
值: 失败次数
```

### Refresh Token Key 设计
```
格式: hqx:refresh_token:{userId}
类型: String
过期: 7 天
值: JWT Refresh Token
```

## 六、降级策略

### Redis 不可用时的处理

**策略 1：熔断降级（推荐）**
```typescript
async checkLoginThrottle(identifier: string): Promise<boolean> {
  try {
    // Redis 操作
    return await this.redisThrottle(identifier);
  } catch (error) {
    this.logger.error('Redis throttle failed, fallback to memory', error);
    // 降级到内存实现
    return this.memoryThrottle(identifier);
  }
}
```

**策略 2：快速失败**
```typescript
// Redis 不可用时拒绝新登录
if (!this.redis.isReady) {
  throw new ServiceUnavailableException('系统维护中，请稍后再试');
}
```

**选择**：
- 开发/测试环境：策略 1（降级到内存）
- 生产环境：策略 2（快速失败，保证数据一致性）

## 七、监控指标

### 关键指标

| 指标 | 正常范围 | 告警阈值 | 说明 |
|------|---------|---------|------|
| Redis 连接数 | < 100 | > 150 | 连接泄漏检测 |
| Session 写入耗时 | < 10ms | > 50ms | 性能监控 |
| Session 命中率 | > 95% | < 90% | 缓存效率 |
| Redis 内存使用率 | < 70% | > 85% | 容量规划 |
| 登录失败节流触发次数 | < 10/小时 | > 50/小时 | 异常登录检测 |

### 监控实现
```typescript
// 使用现有的 winston logger
this.logger.info('Redis session metrics', {
  operation: 'session_write',
  duration: Date.now() - start,
  userId,
});
```

## 八、回滚方案

### 回滚触发条件
1. 错误率 > 5%
2. 响应时间增加 > 50%
3. Redis 集群故障无法快速恢复

### 回滚步骤
1. 修改环境变量 `USE_REDIS_SESSION=false`
2. 重启应用（回退到内存 Session）
3. 修复问题后再次灰度

### 代码兼容性
```typescript
// 保持代码兼容两种模式
const sessionStore = process.env.USE_REDIS_SESSION === 'true'
  ? new RedisStore({ client: redis })
  : new MemoryStore();
```

## 九、性能优化

### 1. 连接池优化
```typescript
const redis = new Redis({
  // ...其他配置
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  // 连接池
  poolSize: 10,
});
```

### 2. Pipeline 批量操作
```typescript
// 批量检查多个 key
async batchCheckThrottle(identifiers: string[]): Promise<Map<string, boolean>> {
  const pipeline = this.redis.pipeline();
  
  identifiers.forEach(id => {
    pipeline.get(`throttle:login:${id}`);
  });
  
  const results = await pipeline.exec();
  // 处理结果...
}
```

### 3. Session 压缩
```typescript
// 对 Session 数据进行 JSON 压缩
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const compress = promisify(gzip);
const decompress = promisify(gunzip);
```

## 十、安全考虑

### 1. Redis 访问控制
```bash
# redis.conf
requirepass <strong-password>
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### 2. 数据加密
```typescript
// Session 数据敏感字段加密
import { createCipheriv, createDecipheriv } from 'crypto';

function encryptSessionData(data: any): string {
  // 使用 AES-256-GCM 加密
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  // ...
}
```

### 3. 网络隔离
- Redis 不对外网开放
- 仅允许应用服务器 IP 访问
- 使用 VPC 内网通信

## 十一、测试用例

### 单元测试
```typescript
describe('RedisSessionStore', () => {
  it('should store and retrieve session', async () => {
    const sessionId = 'test-session-123';
    const sessionData = { userId: 1, username: 'test' };
    
    await store.set(sessionId, sessionData);
    const retrieved = await store.get(sessionId);
    
    expect(retrieved).toEqual(sessionData);
  });
  
  it('should expire session after TTL', async () => {
    // 测试过期逻辑
  });
});

describe('LoginThrottle', () => {
  it('should block after 5 failed attempts', async () => {
    const identifier = 'test@example.com';
    
    for (let i = 0; i < 5; i++) {
      await service.recordFailedLogin(identifier);
    }
    
    const blocked = await service.checkLoginThrottle(identifier);
    expect(blocked).toBe(true);
  });
});
```

### 集成测试
```typescript
describe('Multi-instance Session Sharing', () => {
  it('should share session across instances', async () => {
    // 实例 1 登录
    const response1 = await instance1.post('/auth/login', credentials);
    const cookie = response1.headers['set-cookie'];
    
    // 实例 2 验证
    const response2 = await instance2.get('/user/info', { 
      headers: { cookie } 
    });
    
    expect(response2.status).toBe(200);
  });
});
```

## 十二、成本估算

### 云 Redis 成本（以阿里云为例）

| 环境 | 规格 | 月成本 | 说明 |
|------|------|--------|------|
| 开发 | 256 MB 单机 | ¥50 | 开发测试用 |
| 测试 | 1 GB 单机 | ¥200 | 测试验证用 |
| 预发布 | 2 GB 主从 | ¥600 | 与生产配置一致 |
| 生产 | 4 GB 主从 + Sentinel | ¥1,500 | 高可用配置 |
| **总计** | - | **¥2,350/月** | **¥28,200/年** |

### 性能提升预期
- 支持水平扩展：2 → N 实例
- 会话查询耗时：内存 0.1ms → Redis 1-2ms（可接受）
- 系统可用性：单点故障 → 高可用

## 十三、验收标准

### 功能验收
- [ ] 用户登录后会话存储在 Redis
- [ ] 多实例间会话共享正常
- [ ] 登录失败节流生效（5 次后锁定 15 分钟）
- [ ] Refresh Token 存储和验证正常
- [ ] 用户登出后 Token 被撤销

### 性能验收
- [ ] Session 读取 P99 < 10ms
- [ ] Session 写入 P99 < 20ms
- [ ] 并发 1000 用户无异常
- [ ] Redis 内存使用合理

### 稳定性验收
- [ ] Redis 重启后会话恢复
- [ ] Redis 不可用时降级策略生效
- [ ] 灰度发布期间错误率 < 0.1%

## 十四、后续优化

### 短期（1 个月内）
1. 实现 Session 延长机制（用户活跃时自动续期）
2. 实现在线用户统计
3. 实现强制下线功能（管理员踢人）

### 中期（3 个月内）
1. 迁移到 Redis Cluster（支持更大规模）
2. 实现分布式锁（用于并发控制）
3. 缓存热点数据（用户权限、菜单树等）

### 长期（6 个月内）
1. 实现 Redis Sentinel 高可用
2. 跨区域 Redis 同步（多机房部署）
3. 会话分析和异常检测

---

**方案制定人**：Claude Code  
**审核人**：_____________________  
**批准人**：_____________________  
**批准日期**：_____________________
