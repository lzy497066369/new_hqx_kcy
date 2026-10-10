import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { DeptInput } from './dto';
import { SystemDeptService } from './dept.service';

@Controller('system/dept')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class SystemDeptController {
  constructor(private readonly deptService: SystemDeptService) {}

  @Get('list')
  @RequirePermissions('System:Dept:List')
  async list(): Promise<unknown> {
    return this.deptService.list();
  }

  @Post()
  @RequirePermissions('System:Dept:Create')
  @OperationLog({ module: '系统管理-部门', action: '新增部门' })
  async create(@Body() body: DeptInput): Promise<unknown> {
    return this.deptService.create(body);
  }

  @Put(':id')
  @RequirePermissions('System:Dept:Edit')
  @OperationLog({ module: '系统管理-部门', action: '修改部门' })
  async update(@Param('id') id: string, @Body() body: DeptInput): Promise<unknown> {
    return this.deptService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('System:Dept:Delete')
  @OperationLog({ module: '系统管理-部门', action: '删除部门' })
  async remove(@Param('id') id: string) {
    await this.deptService.remove(id);
    return null;
  }
}
