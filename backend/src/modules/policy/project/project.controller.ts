import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { DeclarationSchemeInput, PolicyProjectInput } from './dto';
import { PolicyProjectService } from './project.service';

@Controller('policy/projects')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class PolicyProjectController {
  constructor(private readonly projectService: PolicyProjectService) {}

  @Get()
  @RequirePermissions('Policy:Project:List')
  async list(@Query() query: Record<string, string | string[] | undefined>): Promise<unknown> {
    return this.projectService.list(query);
  }

  @Get(':id')
  @RequirePermissions('Policy:Project:List')
  async detail(@Param('id') id: string): Promise<unknown> {
    return this.projectService.detail(id);
  }

  @Post()
  @RequirePermissions('Policy:Project:Create')
  @OperationLog({ module: '政策管理-统一政策项目', action: '新增统一政策项目' })
  async create(@Body() body: PolicyProjectInput): Promise<unknown> {
    return this.projectService.create(body);
  }

  @Put(':id')
  @RequirePermissions('Policy:Project:Edit')
  @OperationLog({ module: '政策管理-统一政策项目', action: '修改统一政策项目' })
  async update(@Param('id') id: string, @Body() body: PolicyProjectInput): Promise<unknown> {
    return this.projectService.update(id, body);
  }

  @Post(':id/enable')
  @RequirePermissions('Policy:Project:Edit')
  @OperationLog({ module: '政策管理-统一政策项目', action: '启用统一政策项目' })
  async enable(@Param('id') id: string): Promise<unknown> {
    return this.projectService.setEnabled(id, 1);
  }

  @Post(':id/disable')
  @RequirePermissions('Policy:Project:Edit')
  @OperationLog({ module: '政策管理-统一政策项目', action: '停用统一政策项目' })
  async disable(@Param('id') id: string): Promise<unknown> {
    return this.projectService.setEnabled(id, 0);
  }

  @Get(':id/declaration-schemes')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  async listDeclarationSchemes(@Param('id') id: string): Promise<unknown> {
    return this.projectService.listDeclarationSchemes(id);
  }

  @Post(':id/declaration-schemes')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  @OperationLog({ module: '政策管理-申报方案', action: '新增申报方案' })
  async saveDeclarationScheme(@Param('id') id: string, @Body() body: DeclarationSchemeInput) {
    return this.projectService.saveDeclarationScheme(id, body);
  }

  @Put('declaration-schemes/:id')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  @OperationLog({ module: '政策管理-申报方案', action: '修改申报方案' })
  async updateDeclarationScheme(@Param('id') id: string, @Body() body: DeclarationSchemeInput) {
    return this.projectService.updateDeclarationScheme(id, body);
  }

  @Post('declaration-schemes/:id/publish')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  @OperationLog({ module: '政策管理-申报方案', action: '发布申报方案' })
  async publishDeclarationScheme(@Param('id') id: string) {
    return this.projectService.publishDeclarationScheme(id);
  }

  @Delete(':id')
  @RequirePermissions('Policy:Project:Delete')
  @OperationLog({ module: '政策管理-统一政策项目', action: '删除统一政策项目' })
  async remove(@Param('id') id: string) {
    await this.projectService.remove(id);
    return null;
  }
}
