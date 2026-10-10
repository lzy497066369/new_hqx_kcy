import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { DeclarationPresetInput } from './dto';
import { DeclarationPresetService } from './preset.service';

@Controller('policy/declaration-presets')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class DeclarationPresetController {
  constructor(private readonly presetService: DeclarationPresetService) {}

  @Get()
  @RequirePermissions('Policy:DeclarationPreset:List')
  list(@Query('type') type?: string) {
    return this.presetService.list(type);
  }

  @Post()
  @RequirePermissions('Policy:DeclarationPreset:Manage')
  @OperationLog({ module: '申报配置-预设', action: '新建预设' })
  create(@Body() body: DeclarationPresetInput) {
    return this.presetService.create(body);
  }

  @Put(':id')
  @RequirePermissions('Policy:DeclarationPreset:Manage')
  @OperationLog({ module: '申报配置-预设', action: '修改预设' })
  update(@Param('id') id: string, @Body() body: DeclarationPresetInput) {
    return this.presetService.update(id, body);
  }

  @Post(':id/publish')
  @RequirePermissions('Policy:DeclarationPreset:Manage')
  @OperationLog({ module: '申报配置-预设', action: '发布预设' })
  publish(@Param('id') id: string) {
    return this.presetService.publish(id);
  }
}
