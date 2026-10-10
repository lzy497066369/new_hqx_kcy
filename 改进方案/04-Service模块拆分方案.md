# Service 模块拆分方案

> 优先级：P1  
> 预计工期：1 周规划 + 2 周实施 + 1 周测试  
> 风险等级：中  
> 负责人：后端 Lead

## 一、问题描述

### 当前状况
```
backend/src/modules/client/
├── client.service.ts        853,672 字节 (853 KB) ⚠️
├── client.controller.ts      44,681 字节 (44 KB)
└── services/                 部分业务逻辑已抽离
    ├── archive.service.ts
    ├── declaration.service.ts
    └── ...
```

### 问题分析
1. **单文件过大**：853 KB 的 service 文件包含数千行代码
2. **职责不清**：一个 service 处理企业资料、申报、材料、AI 等多个业务域
3. **维护困难**：
   - 代码定位困难（需要滚动数千行）
   - 合并冲突频繁（多人修改同一文件）
   - 测试编写困难（依赖关系复杂）
   - 加载和编译慢
4. **复用性差**：业务逻辑耦合在一起，难以在其他模块复用

## 二、拆分原则

### 2.1 按业务域拆分（Domain-Driven Design）

```
当前: client.service.ts (单一巨型 Service)
      ├── 企业资料管理
      ├── 申报项目管理
      ├── 材料上传管理
      ├── 财税资料管理
      ├── 员工管理
      ├── 知识产权管理
      ├── AI 能力集成
      └── 工作台数据聚合

拆分后: 按业务域独立 Service
      ├── enterprise-profile.service.ts    # 企业资料
      ├── declaration.service.ts           # 申报管理（已存在）
      ├── material.service.ts              # 材料管理
      ├── finance.service.ts               # 财税资料
      ├── employee.service.ts              # 员工管理
      ├── property.service.ts              # 知识产权
      ├── ai-integration.service.ts        # AI 能力
      └── workspace.service.ts             # 工作台聚合
```

### 2.2 单一职责原则（Single Responsibility Principle）

每个 Service 只负责一个业务域：
- ✅ **好**：`FinanceService.getFinancialRecords()`
- ❌ **差**：`ClientService.getFinancialRecords()`

### 2.3 依赖倒置（Dependency Inversion）

高层模块不应依赖低层模块，都应依赖抽象：
```typescript
// ❌ 直接依赖具体实现
class WorkspaceService {
  constructor(private clientService: ClientService) {}
}

// ✅ 依赖接口
class WorkspaceService {
  constructor(
    private profileService: IEnterpriseProfileService,
    private declarationService: IDeclarationService,
  ) {}
}
```

### 2.4 文件大小约束

- 单个 Service 文件：< 500 行（约 15 KB）
- 单个方法：< 50 行
- 单个类：< 10 个公共方法

## 三、目标架构

### 3.1 模块结构

```
backend/src/modules/client/
├── client.module.ts                      # 模块入口
├── client.controller.ts                  # 路由控制器（保留，简化）
│
├── services/                             # 业务服务层
│   ├── enterprise/                       # 企业资料域
│   │   ├── profile.service.ts
│   │   ├── contact.service.ts
│   │   └── basic-info.service.ts
│   │
│   ├── declaration/                      # 申报域
│   │   ├── declaration.service.ts        # 已存在
│   │   ├── project.service.ts
│   │   └── scheme.service.ts
│   │
│   ├── material/                         # 材料域
│   │   ├── material.service.ts
│   │   ├── template.service.ts
│   │   └── upload.service.ts
│   │
│   ├── finance/                          # 财税域
│   │   ├── finance.service.ts
│   │   ├── financial-record.service.ts
│   │   └── tax-audit.service.ts
│   │
│   ├── employee/                         # 员工域
│   │   ├── employee.service.ts
│   │   ├── import.service.ts
│   │   └── attachment.service.ts
│   │
│   ├── property/                         # 知识产权域
│   │   ├── intellectual-property.service.ts
│   │   ├── research-project.service.ts
│   │   ├── product-service.service.ts
│   │   └── transformation.service.ts
│   │
│   ├── archive/                          # 档案域
│   │   ├── archive.service.ts            # 已存在
│   │   ├── contract.service.ts
│   │   ├── invoice.service.ts
│   │   └── document.service.ts
│   │
│   ├── ai/                               # AI 集成域
│   │   ├── ai-recognition.service.ts
│   │   ├── ai-generation.service.ts
│   │   └── ai-task.service.ts
│   │
│   └── workspace/                        # 工作台聚合
│       ├── workspace.service.ts
│       ├── overview.service.ts
│       └── todo.service.ts
│
├── dto/                                  # 数据传输对象
│   ├── enterprise/
│   ├── declaration/
│   ├── material/
│   └── ...
│
├── entities/                             # 实体定义（如果有自定义实体）
│
└── interfaces/                           # 接口定义
    ├── enterprise-profile.interface.ts
    ├── declaration.interface.ts
    └── ...
```

### 3.2 依赖关系图

```
┌─────────────────────────────────────┐
│      client.controller.ts           │  ← HTTP 层
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    v                 v
┌─────────────┐  ┌─────────────┐
│  Workspace  │  │  Business   │  ← 业务编排层
│  Service    │  │  Services   │
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────┬───────┘
                │
    ┌───────────┴───────────┐
    │                       │
    v                       v
┌─────────────┐      ┌─────────────┐
│  Domain     │      │   Common    │  ← 领域服务层
│  Services   │      │  Services   │
└─────────────┘      └─────────────┘
```

## 四、实施步骤

### 阶段 1：规划与准备（3 天）

#### Day 1：现状分析
1. **代码扫描**：分析 `client.service.ts` 的方法列表
   ```bash
   # 提取所有公共方法
   grep -E "^\s*(public |async )" client.service.ts | wc -l
   ```

2. **依赖分析**：找出被引用的位置
   ```bash
   # 查找引用
   grep -r "ClientService" backend/src/
   ```

3. **职责分类**：将方法按业务域分组
   ```
   企业资料: 120 个方法
   申报管理: 80 个方法
   材料管理: 60 个方法
   财税资料: 40 个方法
   员工管理: 30 个方法
   知识产权: 50 个方法
   AI 集成: 35 个方法
   工作台: 25 个方法
   ```

#### Day 2：接口设计
1. 定义每个 Service 的接口
   ```typescript
   // interfaces/enterprise-profile.interface.ts
   export interface IEnterpriseProfileService {
     getProfile(enterpriseId: number): Promise<EnterpriseProfile>;
     updateProfile(enterpriseId: number, dto: UpdateProfileDto): Promise<void>;
     // ...
   }
   ```

2. 定义 DTO 结构
   ```typescript
   // dto/enterprise/update-profile.dto.ts
   export class UpdateProfileDto {
     @IsOptional()
     @IsString()
     companyName?: string;
     
     @IsOptional()
     @IsString()
     legalPerson?: string;
     // ...
   }
   ```

#### Day 3：测试准备
1. 编写测试框架
   ```typescript
   // __tests__/enterprise-profile.service.spec.ts
   describe('EnterpriseProfileService', () => {
     let service: EnterpriseProfileService;
     let repository: Repository<EnterpriseProfile>;
     
     beforeEach(async () => {
       // 测试准备
     });
     
     it('should get profile', async () => {
       // 测试用例
     });
   });
   ```

2. 准备测试数据

### 阶段 2：核心域拆分（5 天）

#### Day 4-5：企业资料域
```typescript
// services/enterprise/profile.service.ts
@Injectable()
export class EnterpriseProfileService {
  constructor(
    @InjectRepository(EnterpriseProfile)
    private profileRepo: Repository<EnterpriseProfile>,
    private logger: Logger,
  ) {}
  
  async getProfile(enterpriseId: number): Promise<EnterpriseProfile> {
    return this.profileRepo.findOne({ where: { enterpriseId } });
  }
  
  async updateProfile(
    enterpriseId: number, 
    dto: UpdateProfileDto
  ): Promise<void> {
    await this.profileRepo.update({ enterpriseId }, dto);
  }
  
  // 其他企业资料相关方法...
}
```

#### Day 6-7：申报管理域
```typescript
// services/declaration/declaration.service.ts
// 已存在，检查并完善
```

#### Day 8：材料管理域
```typescript
// services/material/material.service.ts
@Injectable()
export class MaterialService {
  async uploadMaterial(dto: UploadMaterialDto): Promise<Material> {
    // 材料上传逻辑
  }
  
  async getMaterials(enterpriseId: number): Promise<Material[]> {
    // 获取材料列表
  }
  
  // ...
}
```

### 阶段 3：支撑域拆分（4 天）

#### Day 9：财税资料域
```typescript
// services/finance/finance.service.ts
```

#### Day 10：员工管理域
```typescript
// services/employee/employee.service.ts
```

#### Day 11：知识产权域
```typescript
// services/property/intellectual-property.service.ts
```

#### Day 12：AI 集成域
```typescript
// services/ai/ai-integration.service.ts
```

### 阶段 4：聚合层实现（2 天）

#### Day 13：工作台服务
```typescript
// services/workspace/workspace.service.ts
@Injectable()
export class WorkspaceService {
  constructor(
    private profileService: EnterpriseProfileService,
    private declarationService: DeclarationService,
    private materialService: MaterialService,
    private financeService: FinanceService,
  ) {}
  
  async getOverview(enterpriseId: number): Promise<WorkspaceOverview> {
    // 聚合多个服务的数据
    const [profile, declarations, materials, finance] = await Promise.all([
      this.profileService.getProfile(enterpriseId),
      this.declarationService.getDeclarations(enterpriseId),
      this.materialService.getMaterials(enterpriseId),
      this.financeService.getFinancialSummary(enterpriseId),
    ]);
    
    return {
      profile,
      declarations,
      materials,
      finance,
    };
  }
}
```

#### Day 14：Controller 简化
```typescript
// client.controller.ts (简化版)
@Controller('client')
export class ClientController {
  constructor(
    private profileService: EnterpriseProfileService,
    private declarationService: DeclarationService,
    private workspaceService: WorkspaceService,
    // 注入各个领域服务，而非单一 ClientService
  ) {}
  
  @Get('enterprise/:id/profile')
  async getProfile(@Param('id') id: number) {
    return this.profileService.getProfile(id);
  }
  
  @Get('workspace/overview')
  async getWorkspaceOverview(@CurrentUser() user) {
    return this.workspaceService.getOverview(user.enterpriseId);
  }
}
```

### 阶段 5：测试与验证（5 天）

#### Day 15-17：单元测试
```bash
# 运行测试
npm run test -- --coverage

# 目标覆盖率
- 语句覆盖率 > 80%
- 分支覆盖率 > 70%
- 函数覆盖率 > 85%
```

#### Day 18-19：集成测试
```typescript
// __tests__/integration/client.e2e.spec.ts
describe('Client Module Integration', () => {
  it('should create declaration', async () => {
    // 完整业务流程测试
  });
});
```

### 阶段 6：灰度上线（2 天）

#### Day 20：预发布验证
1. 部署到预发布环境
2. 完整业务流程验证
3. 性能对比测试

#### Day 21：生产灰度
1. 10% 流量灰度
2. 监控错误率和性能指标
3. 逐步提升到 100%

## 五、重构策略

### 5.1 绞杀者模式（Strangler Fig Pattern）

```
阶段 1: 新旧并存
┌─────────────────────────────────┐
│  ClientService (保留)           │
│  ├─ 企业资料 ──────┐            │
│  ├─ 申报管理       │            │
│  └─ ...            │            │
└────────────────────┼────────────┘
                     │
                     v
          ┌──────────────────────┐
          │ EnterpriseProfile    │
          │ Service (新)         │
          └──────────────────────┘

阶段 2: 逐步替换
┌─────────────────────────────────┐
│  ClientService (逐步清空)        │
│  ├─ 企业资料 (已迁移) ✓         │
│  ├─ 申报管理 (已迁移) ✓         │
│  └─ 材料管理 (待迁移)           │
└─────────────────────────────────┘

阶段 3: 完全替换
┌──────────────────────┐
│ EnterpriseProfile    │
│ Service              │
└──────────────────────┘
┌──────────────────────┐
│ Declaration          │
│ Service              │
└──────────────────────┘
┌──────────────────────┐
│ Material             │
│ Service              │
└──────────────────────┘
ClientService 删除 ✓
```

### 5.2 保留原有接口（Adapter 模式）

在过渡期保持对外接口兼容：

```typescript
// client.service.ts (过渡期保留)
@Injectable()
export class ClientService {
  constructor(
    private profileService: EnterpriseProfileService,
    private declarationService: DeclarationService,
    // ...其他服务
  ) {}
  
  // 保留原有方法签名，委托给新服务
  async getEnterpriseProfile(id: number) {
    return this.profileService.getProfile(id);
  }
  
  async updateEnterpriseProfile(id: number, dto: any) {
    return this.profileService.updateProfile(id, dto);
  }
  
  // 逐步标记为 @deprecated
  /** @deprecated Use EnterpriseProfileService.getProfile instead */
  async getProfile(id: number) {
    return this.profileService.getProfile(id);
  }
}
```

## 六、风险管理

### 6.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| 依赖关系梳理不清 | 高 | 中 | 使用依赖分析工具，绘制依赖图 |
| 循环依赖 | 中 | 中 | 定义清晰的依赖方向，使用接口隔离 |
| 测试覆盖不足 | 高 | 高 | 先补充测试再重构 |
| 业务逻辑遗漏 | 高 | 低 | 代码审查 + 业务验收 |

### 6.2 业务风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| 重构期间引入 Bug | 高 | 中 | 充分测试，灰度发布 |
| 性能下降 | 中 | 低 | 性能基准测试，对比优化 |
| 接口变更影响前端 | 中 | 低 | 保持接口兼容，提前通知 |

## 七、验收标准

### 功能验收
- [ ] 所有原有功能正常
- [ ] 新增单元测试通过
- [ ] 集成测试通过
- [ ] 端到端测试通过

### 代码质量验收
- [ ] 单个 Service 文件 < 500 行
- [ ] 单个方法 < 50 行
- [ ] 测试覆盖率 > 80%
- [ ] ESLint 检查通过
- [ ] 代码审查通过

### 性能验收
- [ ] 接口响应时间无明显增加
- [ ] 数据库查询次数无明显增加
- [ ] 内存使用正常

## 八、长期收益

### 8.1 开发效率提升
- ✅ 代码定位快速（按业务域查找）
- ✅ 合并冲突减少（多人并行开发）
- ✅ 新人上手容易（职责清晰）

### 8.2 代码质量提升
- ✅ 单一职责，易于理解
- ✅ 高内聚低耦合
- ✅ 易于测试和维护

### 8.3 业务扩展性提升
- ✅ 新增功能时只需修改对应 Service
- ✅ 业务逻辑可复用
- ✅ 支持微服务拆分（如有需要）

---

**方案制定人**：Claude Code  
**审核人**：_____________________  
**批准人**：_____________________
