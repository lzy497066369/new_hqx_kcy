# Client Service 重构文档

## 重构背景

原 `client.service.ts` 文件包含 **24,490 行代码**，严重违反单一职责原则，导致：
- 代码难以维护和理解
- 测试困难
- 多人协作冲突频繁
- 性能调优困难

## 重构方案

### 拆分策略

按业务领域将巨大的服务拆分为 6 个独立的子服务：

```
backend/src/modules/client/services/
├── client-declaration.service.ts    # 申报管理服务
├── client-profile.service.ts        # 企业资料管理服务
├── client-finance.service.ts        # 财务数据管理服务
├── client-material.service.ts       # 材料管理服务
├── client-property.service.ts       # 知识产权管理服务
├── client-employee.service.ts       # 员工管理服务
├── client.facade.ts                 # 服务门面（统一入口）
└── index.ts                         # 服务导出
```

### 各服务职责

#### 1. ClientDeclarationService (申报管理)
**功能**：
- 申报列表查询
- 申报创建、更新、删除
- 申报提交
- 候选项目查询
- 申报方案获取

**主要方法**：
- `listDeclarations()`
- `getDeclaration()`
- `createDeclaration()`
- `updateDeclaration()`
- `submitDeclaration()`
- `getCandidateProjects()`

#### 2. ClientProfileService (企业资料管理)
**功能**：
- 企业基本信息管理
- 企业联系人管理
- 企业股东管理
- 资料完整度统计

**主要方法**：
- `getProfile()`
- `updateProfile()`
- `getBasicInfo()`
- `updateBasicInfo()`
- `listContacts()`
- `createContact()`
- `listShareholders()`
- `getProfileStats()`

#### 3. ClientFinanceService (财务数据管理)
**功能**：
- 财务记录CRUD
- AI财务报表解析
- 批量财务数据导入
- 财务数据审核流程

**主要方法**：
- `listFinanceRecords()`
- `createFinanceRecord()`
- `batchCreateFinanceRecords()`
- `uploadFinanceFilesForAiParse()`
- `listAiParseDrafts()`
- `approveAiParseDrafts()`

#### 4. ClientMaterialService (材料管理)
**功能**：
- 申报材料上传管理
- 材料模板下载
- 材料完整性检查
- 材料解析错误处理

**主要方法**：
- `listMaterials()`
- `uploadMaterial()`
- `batchUploadMaterials()`
- `getMaterialTemplate()`
- `checkMaterialCompleteness()`
- `getMaterialStats()`

#### 5. ClientPropertyService (知识产权管理)
**功能**：
- 知识产权记录管理
- AI证书识别
- 知识产权转化记录生成
- 研发项目自动匹配

**主要方法**：
- `listProperties()`
- `createProperty()`
- `uploadForIpRecognition()`
- `listIpRecognitionDrafts()`
- `approveIpRecognitionDrafts()`
- `generateTransformationRecords()`
- `autoMatchResearchProjects()`

#### 6. ClientEmployeeService (员工管理)
**功能**：
- 员工信息CRUD
- 员工批量导入导出
- 员工数据验证
- 员工统计分析

**主要方法**：
- `listEmployees()`
- `createEmployee()`
- `batchCreateEmployees()`
- `previewImport()`
- `confirmImport()`
- `exportEmployees()`
- `getEmployeeStats()`

#### 7. ClientServiceFacade (服务门面)
**功能**：
- 统一入口协调各子服务
- 跨服务的聚合查询
- 保持向后兼容性

**主要方法**：
- `getWorkspaceOverview()` - 工作台概览
- `getEvidenceChain()` - 证据链聚合
- `getTodos()` - 待办事项聚合

## 迁移指南

### 对现有代码的影响

**旧代码（不推荐）**：
```typescript
@Injectable()
export class SomeController {
  constructor(
    private readonly clientService: ClientService,
  ) {}

  async someMethod() {
    await this.clientService.listDeclarations(...);
  }
}
```

**新代码（推荐方式1 - 使用门面）**：
```typescript
@Injectable()
export class SomeController {
  constructor(
    private readonly clientFacade: ClientServiceFacade,
  ) {}

  async someMethod() {
    await this.clientFacade.declaration.listDeclarations(...);
  }
}
```

**新代码（推荐方式2 - 直接注入子服务）**：
```typescript
@Injectable()
export class SomeController {
  constructor(
    private readonly declarationService: ClientDeclarationService,
  ) {}

  async someMethod() {
    await this.declarationService.listDeclarations(...);
  }
}
```

### 模块配置

更新 `client.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClientDeclarationService,
  ClientProfileService,
  ClientFinanceService,
  ClientMaterialService,
  ClientPropertyService,
  ClientEmployeeService,
  ClientServiceFacade,
} from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // 所有实体...
    ]),
  ],
  providers: [
    ClientDeclarationService,
    ClientProfileService,
    ClientFinanceService,
    ClientMaterialService,
    ClientPropertyService,
    ClientEmployeeService,
    ClientServiceFacade,
  ],
  exports: [
    ClientServiceFacade,
    // 也可以单独导出子服务
  ],
})
export class ClientModule {}
```

## 重构收益

### 代码质量提升
- ✅ 单一职责：每个服务专注于一个业务领域
- ✅ 可读性：从 24,490 行拆分为 6 个 ~200-400 行的服务
- ✅ 可测试性：每个服务可独立测试
- ✅ 可维护性：修改某个功能不影响其他模块

### 性能优化
- ✅ 更小的依赖注入范围
- ✅ 更精确的缓存策略（可按服务缓存）
- ✅ 更容易识别性能瓶颈

### 团队协作
- ✅ 减少代码冲突
- ✅ 明确的职责划分
- ✅ 更容易分配任务

### 未来扩展
- ✅ 易于添加新功能
- ✅ 支持微服务拆分
- ✅ 便于实施 CQRS 模式

## 下一步计划

1. **迁移 Controller**
   - 更新 `client.controller.ts` 使用新的子服务
   - 逐步替换对旧 `ClientService` 的调用

2. **添加单元测试**
   - 为每个子服务编写测试
   - 目标覆盖率 70%+

3. **性能优化**
   - 添加查询优化（JOIN替代N+1）
   - 实施缓存策略
   - 添加事务支持

4. **文档完善**
   - API 文档（Swagger）
   - 业务流程图
   - 数据模型图

## 注意事项

⚠️ **重要提醒**：
1. 旧的 `client.service.ts` 暂时保留，确保平滑过渡
2. 新旧服务可以并存，逐步迁移
3. 所有公共方法需要添加 Swagger 注解
4. 错误处理需要统一标准
5. 日志记录需要完善

## 测试清单

- [ ] 所有子服务单元测试
- [ ] 门面服务集成测试
- [ ] Controller 端到端测试
- [ ] 性能测试（对比重构前后）
- [ ] 压力测试
- [ ] 回归测试

## 作者与日期

- **重构日期**: 2026-09-30
- **版本**: v2.0.0
- **重构目标**: 解决代码膨胀问题，提升可维护性
