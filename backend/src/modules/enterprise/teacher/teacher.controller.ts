import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequireRoles } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { EnterpriseTeacherInput } from './dto';
import { EnterpriseTeacherService } from './teacher.service';

@Controller('enterprise/teacher')
@RequireRoles('admin', 'super_admin')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class EnterpriseTeacherController {
  constructor(private readonly teacherService: EnterpriseTeacherService) {}

  @Get('candidates')
  async candidates(): Promise<unknown> {
    return this.teacherService.candidates();
  }

  @Get('list')
  async list(
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    return this.teacherService.list(query);
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<unknown> {
    return this.teacherService.detail(id);
  }

  @Post()
  @OperationLog({ module: '企业管理-项目老师', action: '绑定项目老师' })
  async create(@Body() body: EnterpriseTeacherInput): Promise<unknown> {
    return this.teacherService.create(body);
  }

  @Put(':id')
  @OperationLog({ module: '企业管理-项目老师', action: '修改项目老师绑定' })
  async update(
    @Param('id') id: string,
    @Body() body: EnterpriseTeacherInput,
  ): Promise<unknown> {
    return this.teacherService.update(id, body);
  }

  @Delete(':id')
  @OperationLog({ module: '企业管理-项目老师', action: '删除项目老师绑定' })
  async remove(@Param('id') id: string) {
    await this.teacherService.remove(id);
    return null;
  }
}
