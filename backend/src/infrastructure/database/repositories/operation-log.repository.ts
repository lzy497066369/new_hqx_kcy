import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OperationLogEntity } from '../entities/operation-log.entity';

@Injectable()
export class OperationLogRepository {
  constructor(
    @InjectRepository(OperationLogEntity)
    private readonly operationLogRepo: Repository<OperationLogEntity>,
  ) {}

  createAndSave(
    data: Partial<OperationLogEntity>,
  ): Promise<OperationLogEntity> {
    return this.operationLogRepo.save(this.operationLogRepo.create(data));
  }

  findAll() {
    return this.operationLogRepo.find({
      order: {
        id: 'DESC',
      },
    });
  }
}
