import { Injectable } from '@nestjs/common';
import { ClientDeclarationService } from './client-declaration.service';
import { ClientProfileService } from './client-profile.service';
import { ClientFinanceService } from './client-finance.service';
import { ClientMaterialService } from './client-material.service';
import { ClientPropertyService } from './client-property.service';
import { ClientEmployeeService } from './client-employee.service';

/**
 * 客户端服务门面
 * 作为统一入口协调各个子服务，保持向后兼容性
 */
@Injectable()
export class ClientServiceFacade {
  constructor(
    public readonly declaration: ClientDeclarationService,
    public readonly profile: ClientProfileService,
    public readonly finance: ClientFinanceService,
    public readonly material: ClientMaterialService,
    public readonly property: ClientPropertyService,
    public readonly employee: ClientEmployeeService,
  ) {}

  // 可以在这里添加跨服务的协调方法

  /**
   * 获取企业工作台概览
   * 聚合多个子服务的数据
   */
  async getWorkspaceOverview(enterpriseId: string) {
    const [
      declarations,
      profile,
      materialStats,
      propertyStats,
      employeeStats,
    ] = await Promise.all([
      this.declaration.listDeclarations(0, enterpriseId),
      this.profile.getProfile(enterpriseId),
      this.material.getMaterialStats(enterpriseId),
      this.property.getPropertyStats(enterpriseId),
      this.employee.getEmployeeStats(enterpriseId),
    ]);

    return {
      enterprise: profile,
      declarations: {
        total: declarations.length,
        recent: declarations.slice(0, 5),
      },
      materials: materialStats,
      properties: propertyStats,
      employees: employeeStats,
    };
  }

  /**
   * 获取企业证据链
   * 整合多个模块的数据形成证据链
   */
  async getEvidenceChain(enterpriseId: string) {
    const [
      profile,
      properties,
      employees,
      finances,
    ] = await Promise.all([
      this.profile.getProfile(enterpriseId),
      this.property.listProperties(enterpriseId),
      this.employee.listEmployees(enterpriseId),
      this.finance.listFinanceRecords(enterpriseId),
    ]);

    return {
      basicInfo: {
        name: profile.name,
        creditCode: profile.creditCode,
      },
      intellectualProperty: {
        total: properties.length,
        items: properties.slice(0, 10),
      },
      humanResources: {
        total: employees.length,
        rdPersonnel: employees.filter(e => e.department === 'R&D').length,
      },
      financialData: {
        total: finances.length,
        records: finances.slice(0, 12),
      },
    };
  }

  /**
   * 获取待办事项
   */
  async getTodos(enterpriseId: string) {
    const [
      declarations,
      aiDrafts,
    ] = await Promise.all([
      this.declaration.listDeclarations(0, enterpriseId),
      this.finance.listAiParseDrafts(enterpriseId),
    ]);

    const todos = [];

    // 待提交的申报
    const draftDeclarations = declarations.filter(d => d.status === 'draft');
    if (draftDeclarations.length > 0) {
      todos.push({
        type: 'declaration_draft',
        count: draftDeclarations.length,
        message: `您有 ${draftDeclarations.length} 个申报待提交`,
      });
    }

    // 待处理的AI草稿
    const pendingDrafts = aiDrafts.filter(d => d.status === 'pending');
    if (pendingDrafts.length > 0) {
      todos.push({
        type: 'ai_draft_pending',
        count: pendingDrafts.length,
        message: `您有 ${pendingDrafts.length} 个AI解析结果待审核`,
      });
    }

    return todos;
  }
}
