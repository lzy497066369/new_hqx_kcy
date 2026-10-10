import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { EnterpriseEmployeeRecordEntity } from '../../../infrastructure/database/entities/enterprise-employee-record.entity';

type EmployeeInput = DeepPartial<EnterpriseEmployeeRecordEntity> & {
  name?: string | null;
  hireDate?: string | null;
  employmentType?: number | null;
  education?: number | null;
};

/**
 * 客户端员工管理服务
 * 负责处理企业员工信息的管理、导入导出等功能
 */
@Injectable()
export class ClientEmployeeService {
  constructor(
    @InjectRepository(EnterpriseEmployeeRecordEntity)
    private readonly employeeRepo: Repository<EnterpriseEmployeeRecordEntity>,
  ) {}

  /**
   * 获取企业员工列表
   */
  async listEmployees(enterpriseId: string, filters?: any) {
    const queryBuilder = this.employeeRepo
      .createQueryBuilder('employee')
      .where('employee.enterpriseId = :enterpriseId', { enterpriseId })
      .orderBy('employee.createdAt', 'DESC');

    if (filters?.department) {
      queryBuilder.andWhere('employee.department = :department', {
        department: filters.department,
      });
    }

    if (filters?.employmentType) {
      queryBuilder.andWhere('employee.ygLx = :employmentType', {
        employmentType: filters.employmentType,
      });
    }

    if (filters?.keyword) {
      queryBuilder.andWhere(
        '(employee.ygName LIKE :keyword OR employee.idCard LIKE :keyword)',
        { keyword: `%${filters.keyword}%` },
      );
    }

    return queryBuilder.getMany();
  }

  /**
   * 创建员工记录
   */
  private employeeValues(enterpriseId: string, data: EmployeeInput): DeepPartial<EnterpriseEmployeeRecordEntity> {
    const { name, hireDate, employmentType, education, ...fields } = data;
    return {
      ...fields,
      ygName: fields.ygName ?? name,
      entryDate: fields.entryDate ?? hireDate,
      ygLx: fields.ygLx ?? employmentType,
      ygXl: fields.ygXl ?? education,
      enterpriseId,
    };
  }

  async createEmployee(enterpriseId: string, data: EmployeeInput) {
    const employee = this.employeeRepo.create(this.employeeValues(enterpriseId, data));

    return this.employeeRepo.save(employee);
  }

  /**
   * 批量创建员工记录
   */
  async batchCreateEmployees(enterpriseId: string, employees: EmployeeInput[]) {
    const entities = employees.map(data =>
      this.employeeRepo.create(this.employeeValues(enterpriseId, data)),
    );

    return this.employeeRepo.save(entities);
  }

  /**
   * 更新员工记录
   */
  async updateEmployee(
    employeeId: string,
    enterpriseId: string,
    data: any,
  ) {
    await this.employeeRepo.update(
      { id: employeeId, enterpriseId },
      data,
    );

    return this.employeeRepo.findOne({
      where: { id: employeeId, enterpriseId },
    });
  }

  /**
   * 删除员工记录
   */
  async deleteEmployee(employeeId: string, enterpriseId: string) {
    await this.employeeRepo.delete({ id: employeeId, enterpriseId });
  }

  /**
   * 批量删除员工记录
   */
  async batchDeleteEmployees(enterpriseId: string, employeeIds: string[]) {
    await this.employeeRepo.delete({
      id: employeeIds as any,
      enterpriseId,
    });
  }

  /**
   * 预览导入数据
   */
  async previewImport(enterpriseId: string, data: any[]) {
    // 验证数据格式
    const errors: any[] = [];
    const validRecords: any[] = [];

    data.forEach((record, index) => {
      const rowErrors: string[] = [];

      // 必填字段验证
      if (!record.name) {
        rowErrors.push('姓名不能为空');
      }
      if (!record.idCard) {
        rowErrors.push('身份证号不能为空');
      } else if (!this.validateIdCard(record.idCard)) {
        rowErrors.push('身份证号格式不正确');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: index + 1,
          data: record,
          errors: rowErrors,
        });
      } else {
        validRecords.push(record);
      }
    });

    return {
      total: data.length,
      valid: validRecords.length,
      invalid: errors.length,
      errors,
      preview: validRecords.slice(0, 10), // 预览前10条
    };
  }

  /**
   * 确认导入
   */
  async confirmImport(enterpriseId: string, data: any[]) {
    // 再次验证
    const validRecords = data.filter(
      record => record.name && record.idCard && this.validateIdCard(record.idCard),
    );

    // 批量创建
    return this.batchCreateEmployees(enterpriseId, validRecords);
  }

  /**
   * 导出员工数据
   */
  async exportEmployees(enterpriseId: string) {
    const employees = await this.employeeRepo.find({
      where: { enterpriseId },
      order: { createdAt: 'DESC' },
    });

    // 转换为导出格式
    return employees.map(employee => ({
      姓名: employee.ygName,
      身份证号: employee.idCard,
      部门: employee.department,
      职位: employee.position,
      入职日期: employee.entryDate,
      雇佣类型: employee.ygLx,
      联系电话: null, // 当前员工表不存储联系电话，不编造数据。
      学历: employee.ygXl,
    }));
  }

  /**
   * 下载员工导入模板
   */
  async downloadImportTemplate() {
    return {
      filename: '员工信息导入模板.xlsx',
      columns: [
        { field: 'name', label: '姓名', required: true },
        { field: 'idCard', label: '身份证号', required: true },
        { field: 'department', label: '部门' },
        { field: 'position', label: '职位' },
        { field: 'hireDate', label: '入职日期' },
        { field: 'employmentType', label: '雇佣类型' },
        { field: 'phone', label: '联系电话' },
        { field: 'education', label: '学历' },
      ],
    };
  }

  /**
   * 获取员工统计信息
   */
  async getEmployeeStats(enterpriseId: string) {
    const employees = await this.employeeRepo.find({
      where: { enterpriseId },
    });

    const stats = {
      total: employees.length,
      byDepartment: {} as Record<string, number>,
      byEmploymentType: {} as Record<string, number>,
      byEducation: {} as Record<string, number>,
    };

    employees.forEach(employee => {
      // 按部门统计
      if (employee.department) {
        stats.byDepartment[employee.department] =
          (stats.byDepartment[employee.department] || 0) + 1;
      }

      // 按雇佣类型统计
      if (employee.ygLx) {
        stats.byEmploymentType[employee.ygLx] =
          (stats.byEmploymentType[employee.ygLx] || 0) + 1;
      }

      // 按学历统计
      if (employee.ygXl) {
        stats.byEducation[employee.ygXl] =
          (stats.byEducation[employee.ygXl] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * 验证身份证号
   */
  private validateIdCard(idCard: string): boolean {
    // 简单的身份证号验证
    const pattern = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    return pattern.test(idCard);
  }
}
