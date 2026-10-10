import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AiResultEntity } from '../../infrastructure/database/entities/ai-result.entity';
import { toStringId } from '../system/shared/system.utils';

@Injectable()
export class AiResultService {
  constructor(
    @InjectRepository(AiResultEntity)
    private readonly resultRepo: Repository<AiResultEntity>,
  ) {}

  async createResult(input: {
    confidence?: null | string;
    scene: string;
    structuredResult: unknown;
    summary: null | string;
    taskId: string;
  }): Promise<AiResultEntity> {
    const result = this.resultRepo.create({
      confidence: input.confidence ?? null,
      scene: input.scene,
      status: 'draft',
      structuredResult: JSON.stringify(input.structuredResult),
      summary: input.summary,
      taskId: input.taskId,
    });

    return this.resultRepo.save(result);
  }

  async updateStatus(
    id: string,
    status: 'confirmed' | 'rejected',
    userId?: number | string,
  ): Promise<AiResultEntity> {
    const result = await this.resultRepo.findOne({ where: { id: toStringId(id) } });
    if (!result) {
      throw new NotFoundException('AI result not found');
    }
    result.status = status;
    result.confirmedAt = new Date();
    result.confirmedBy = userId === undefined ? null : String(userId);
    return this.resultRepo.save(result);
  }
}
