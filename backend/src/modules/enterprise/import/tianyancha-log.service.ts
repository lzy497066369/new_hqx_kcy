import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TianyanchaApiCallLogEntity } from '../../../infrastructure/database/entities/tianyancha-api-call-log.entity';

export interface TianyanchaApiLogInput {
  apiCode: string;
  apiName: string;
  apiUrl: string;
  companyName?: null | string;
  createdBy?: null | string;
  creditCode?: null | string;
  durationMs?: null | number;
  enterpriseId?: null | string;
  errorMessage?: null | string;
  httpMethod: string;
  httpStatus?: null | number;
  requestBodyJson?: null | string;
  requestHeadersMaskedJson?: null | string;
  requestKeyword?: null | string;
  requestParamsJson?: null | string;
  responseHash?: null | string;
  responseJson?: null | string;
  responseStatus: string;
  tycCode?: null | string;
  tycEnterpriseId?: null | string;
  tycMessage?: null | string;
}

@Injectable()
export class TianyanchaLogService {
  constructor(
    @InjectRepository(TianyanchaApiCallLogEntity)
    private readonly apiLogRepo: Repository<TianyanchaApiCallLogEntity>,
  ) {}

  async createLog(input: TianyanchaApiLogInput): Promise<TianyanchaApiCallLogEntity> {
    return this.apiLogRepo.save(
      this.apiLogRepo.create({
        apiCode: input.apiCode,
        apiName: input.apiName,
        apiUrl: input.apiUrl,
        companyName: input.companyName ?? null,
        createdBy: input.createdBy ?? null,
        creditCode: input.creditCode ?? null,
        durationMs: input.durationMs ?? null,
        enterpriseId: input.enterpriseId ?? null,
        errorMessage: input.errorMessage ?? null,
        httpMethod: input.httpMethod,
        httpStatus: input.httpStatus ?? null,
        requestBodyJson: input.requestBodyJson ?? null,
        requestHeadersMaskedJson: input.requestHeadersMaskedJson ?? null,
        requestKeyword: input.requestKeyword ?? null,
        requestParamsJson: input.requestParamsJson ?? null,
        responseHash: input.responseHash ?? null,
        responseJson: input.responseJson ?? null,
        responseStatus: input.responseStatus,
        tycCode: input.tycCode ?? null,
        tycEnterpriseId: input.tycEnterpriseId ?? null,
        tycMessage: input.tycMessage ?? null,
      }),
    );
  }

  async bindEnterprise(logId: string, enterpriseId: string): Promise<void> {
    await this.apiLogRepo.update(
      { id: logId },
      {
        enterpriseId,
      },
    );
  }
}
