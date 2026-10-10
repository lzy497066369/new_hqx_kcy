import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type CrmSyncEventType = 'cancelled' | 'created' | 'updated';

export class CrmContractSyncInput {
  @IsString()
  @MaxLength(128)
  sourceRequestId!: string;

  @IsOptional() @IsString() @MaxLength(128)
  sourceRecordId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  sourceUpdatedAt?: string;

  @IsOptional() @IsString() @MaxLength(64)
  sourceVersion?: string;

  @IsOptional() @IsString() @IsIn(['cancelled', 'created', 'updated'])
  eventType?: CrmSyncEventType;

  @IsString()
  @MaxLength(255)
  companyName!: string;

  @IsOptional() @IsString() @MaxLength(64)
  sequenceNo?: string;

  @IsOptional() @IsString() @MaxLength(128)
  contractNo?: string;

  @IsOptional() @IsString() @MaxLength(128)
  customerContractNo?: string;

  @IsOptional() @IsString() @MaxLength(128)
  vendorName?: string;

  @IsOptional() @IsString() @MaxLength(255)
  contractName?: string;

  @IsOptional() @IsString() @MaxLength(64)
  accountManagerName?: string;
}

export class CrmExecutionOrderSyncInput {
  @IsString()
  @MaxLength(128)
  sourceRequestId!: string;

  @IsOptional() @IsString() @MaxLength(128)
  sourceRecordId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  sourceUpdatedAt?: string;

  @IsOptional() @IsString() @MaxLength(64)
  sourceVersion?: string;

  @IsOptional() @IsString() @IsIn(['cancelled', 'created', 'updated'])
  eventType?: CrmSyncEventType;

  @IsString()
  @MaxLength(128)
  orderNo!: string;

  @IsString()
  @MaxLength(255)
  companyName!: string;

  @IsString()
  @MaxLength(500)
  executionOrderName!: string;

  @IsOptional() @IsString() @MaxLength(128)
  contractNo?: string;

  @IsOptional() @IsString() @MaxLength(64)
  contractReviewStatus?: string;

  @IsOptional() @IsString() @MaxLength(32)
  isCarriedForward?: string;

  @IsOptional() @IsString() @MaxLength(128)
  executionDepartment?: string;

  @IsOptional() @IsString() @MaxLength(64)
  accountManagerName?: string;

  @IsOptional() @IsString() @MaxLength(64)
  productManagerName?: string;
}

export class CreateCrmIntegrationClientInput {
  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional() @IsString() @MaxLength(64)
  appId?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  allowedIpCidrs?: string;

  @IsOptional() @IsInt() @Min(1) @Max(600)
  rateLimitPerMinute?: number;
}

export class CreateCrmIntegrationKeyInput {
  @IsOptional() @IsString() @MaxLength(64)
  keyId?: string;

  @IsOptional() @IsString() @MaxLength(255)
  scopes?: string;

  @IsOptional() @IsString() @MaxLength(40)
  expiresAt?: string;
}
