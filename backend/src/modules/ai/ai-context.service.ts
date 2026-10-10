import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RegionPolicyFileEntity } from '../../infrastructure/database/entities/region-policy-file.entity';
import { toStringId } from '../system/shared/system.utils';
import type { AiSceneContext } from './ai.types';

@Injectable()
export class AiContextService {
  constructor(
    @InjectRepository(RegionPolicyFileEntity)
    private readonly policyFileRepo: Repository<RegionPolicyFileEntity>,
  ) {}

  async buildContext(bizType: string, bizId: string): Promise<AiSceneContext> {
    if (bizType === 'policy_file') {
      return this.buildPolicyFileContext(bizId);
    }

    throw new BadRequestException(`Unsupported AI bizType: ${bizType}`);
  }

  private async buildPolicyFileContext(bizId: string): Promise<AiSceneContext> {
    const policyFile = await this.policyFileRepo.findOne({
      where: { id: toStringId(bizId) },
    });
    if (!policyFile) {
      throw new NotFoundException('Policy file not found');
    }

    return {
      bizId: String(policyFile.id),
      bizType: 'policy_file',
      data: {
        applicationLevel: policyFile.applicationLevel,
        conditionText: policyFile.conditionText,
        content: policyFile.content,
        endDate: policyFile.endDate,
        materialText: policyFile.materialText,
        projectName: policyFile.projectName,
        regionName: policyFile.regionName,
        startDate: policyFile.startDate,
        subsidyAmountMax: policyFile.subsidyAmountMax,
        subsidyAmountMin: policyFile.subsidyAmountMin,
        subsidyText: policyFile.subsidyText,
        targetObjects: policyFile.targetObjects,
        title: policyFile.title,
      },
      title: policyFile.title,
    };
  }
}
