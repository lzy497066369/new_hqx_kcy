import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { OperationLog } from '../../common/decorators/operation-log.decorator';
import { RequirePermissions } from '../../common/decorators/require-access.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CreateCrmIntegrationClientInput, CreateCrmIntegrationKeyInput, CrmContractSyncInput, CrmExecutionOrderSyncInput } from './dto';
import { CrmIntegrationService } from './crm-integration.service';
import { CrmSyncService } from './crm-sync.service';

@Controller('integration/crm')
export class CrmSyncExternalController {
  constructor(private readonly crmSyncService: CrmSyncService) {}

  @Post('contracts')
  receiveContract(
    @Headers('x-crm-token') token: string | undefined,
    @Body() body: CrmContractSyncInput,
  ) {
    this.crmSyncService.assertExternalToken(token);
    return this.crmSyncService.receiveContract(body);
  }

  @Post('execution-orders')
  receiveExecutionOrder(
    @Headers('x-crm-token') token: string | undefined,
    @Body() body: CrmExecutionOrderSyncInput,
  ) {
    this.crmSyncService.assertExternalToken(token);
    return this.crmSyncService.receiveExecutionOrder(body);
  }
}

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('integration/v2/crm')
export class CrmSyncV2ExternalController {
  constructor(private readonly crmIntegrationService: CrmIntegrationService) {}

  @Post('contracts')
  @HttpCode(HttpStatus.ACCEPTED)
  receiveContract(@Body() body: unknown, @Req() request: RawBodyRequest) {
    return this.crmIntegrationService.acceptContract(body, this.signedRequest(request));
  }

  @Post('execution-orders')
  @HttpCode(HttpStatus.ACCEPTED)
  receiveExecutionOrder(@Body() body: unknown, @Req() request: RawBodyRequest) {
    return this.crmIntegrationService.acceptExecutionOrder(body, this.signedRequest(request));
  }

  @Get('requests/:sourceRequestId')
  getRequestStatus(
    @Param('sourceRequestId') sourceRequestId: string,
    @Query('type') type: string,
    @Req() request: RawBodyRequest,
  ) {
    if (type !== 'contract' && type !== 'execution_order') {
      throw new BadRequestException('type 必须为 contract 或 execution_order');
    }
    return this.crmIntegrationService.getExternalRequestStatus(
      type,
      sourceRequestId,
      this.signedRequest(request, `?type=${encodeURIComponent(type)}`),
    );
  }

  private signedRequest(request: RawBodyRequest, query = '') {
    return {
      body: request.rawBody ?? Buffer.alloc(0),
      headers: request.headers,
      ip: request.socket.remoteAddress,
      method: request.method,
      pathAndQuery: `${request.path}${query}`,
    };
  }
}

@Controller('crm-sync')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class CrmSyncAdminController {
  constructor(private readonly crmSyncService: CrmSyncService) {}

  @Get('contracts')
  @RequirePermissions('Crm:Sync:List')
  listContracts(@Query() query: Record<string, string | string[] | undefined>) {
    return this.crmSyncService.listContracts(query);
  }

  @Get('contracts/:id')
  @RequirePermissions('Crm:Sync:List')
  getContractDetail(@Param('id') id: string) {
    return this.crmSyncService.getContractDetail(id);
  }

  @Post('contracts/:id/retry')
  @RequirePermissions('Crm:Sync:Retry')
  @OperationLog({ module: 'CRM同步', action: '重试合同同步' })
  retryContract(@Param('id') id: string, @CurrentUserInfo() user: CurrentUser) {
    return this.crmSyncService.retryContract(id, user.username);
  }

  @Get('execution-orders')
  @RequirePermissions('Crm:Sync:List')
  listExecutionOrders(@Query() query: Record<string, string | string[] | undefined>) {
    return this.crmSyncService.listExecutionOrders(query);
  }

  @Get('execution-orders/:id')
  @RequirePermissions('Crm:Sync:List')
  getExecutionOrderDetail(@Param('id') id: string) {
    return this.crmSyncService.getExecutionOrderDetail(id);
  }

  @Post('execution-orders/:id/retry')
  @RequirePermissions('Crm:Sync:Retry')
  @OperationLog({ module: 'CRM同步', action: '重试执行单同步' })
  retryExecutionOrder(@Param('id') id: string, @CurrentUserInfo() user: CurrentUser) {
    return this.crmSyncService.retryExecutionOrder(id, user.username);
  }
}

@Controller('crm-integration')
@UseGuards(AccessTokenGuard, PermissionGuard)
export class CrmIntegrationAdminController {
  constructor(private readonly crmIntegrationService: CrmIntegrationService) {}

  @Get('clients')
  @RequirePermissions('Crm:Integration:Manage')
  listClients() {
    return this.crmIntegrationService.listClients();
  }

  @Post('clients')
  @RequirePermissions('Crm:Integration:Manage')
  @OperationLog({ module: 'CRM集成', action: '创建调用方' })
  createClient(@Body() body: CreateCrmIntegrationClientInput) {
    return this.crmIntegrationService.createClient(body);
  }

  @Post('clients/:id/keys')
  @RequirePermissions('Crm:Integration:Manage')
  @OperationLog({ module: 'CRM集成', action: '创建签名密钥' })
  createKey(@Param('id') id: string, @Body() body: CreateCrmIntegrationKeyInput) {
    return this.crmIntegrationService.createKey(id, body);
  }

  @Post('keys/:id/disable')
  @RequirePermissions('Crm:Integration:Manage')
  @OperationLog({ module: 'CRM集成', action: '停用签名密钥' })
  disableKey(@Param('id') id: string) {
    return this.crmIntegrationService.disableKey(id);
  }

  @Get('requests')
  @RequirePermissions('Crm:Integration:Manage')
  listRequests(@Query() query: Record<string, string | string[] | undefined>) {
    return this.crmIntegrationService.listInboundRequests(query);
  }

  @Post('requests/:id/retry')
  @RequirePermissions('Crm:Integration:Manage')
  @OperationLog({ module: 'CRM集成', action: '重新执行入站请求' })
  retryRequest(@Param('id') id: string) {
    return this.crmIntegrationService.retryInboundRequest(id);
  }
}
