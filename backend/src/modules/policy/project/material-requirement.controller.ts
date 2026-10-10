import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import {
  ProjectMaterialRequirementInput,
  ProjectMaterialRequirementItemInput,
} from './dto';
import { PolicyProjectService } from './project.service';

@Controller('admin')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class ProjectMaterialRequirementController {
  constructor(private readonly projectService: PolicyProjectService) {}

  @Get('projects/:id/material-requirement')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  async getRequirement(@Param('id') id: string): Promise<unknown> {
    return this.projectService.getProjectMaterialRequirementDetail(id);
  }

  @Post('projects/:id/material-requirement')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  @OperationLog({ module: '政策管理-材料要求', action: '保存项目材料要求' })
  async saveRequirement(
    @Param('id') id: string,
    @Body() body: ProjectMaterialRequirementInput,
  ): Promise<unknown> {
    return this.projectService.saveProjectMaterialRequirement(id, body);
  }

  @Post('project-material-requirement-items')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  @OperationLog({ module: '政策管理-材料要求', action: '新增材料要求项' })
  async createRequirementItem(
    @Body() body: ProjectMaterialRequirementItemInput,
  ): Promise<unknown> {
    return this.projectService.createProjectMaterialRequirementItem(body);
  }

  @Put('project-material-requirement-items/:id')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  @OperationLog({ module: '政策管理-材料要求', action: '修改材料要求项' })
  async updateRequirementItem(
    @Param('id') id: string,
    @Body() body: ProjectMaterialRequirementItemInput,
  ): Promise<unknown> {
    return this.projectService.updateProjectMaterialRequirementItem(id, body);
  }

  @Delete('project-material-requirement-items/:id')
  @RequirePermissions('Policy:Project:MaterialRequirement')
  @OperationLog({ module: '政策管理-材料要求', action: '删除材料要求项' })
  async deleteRequirementItem(@Param('id') id: string): Promise<null> {
    await this.projectService.deleteProjectMaterialRequirementItem(id);
    return null;
  }
}
