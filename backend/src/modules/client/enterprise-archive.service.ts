import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnterpriseTeacherEntity } from '../../infrastructure/database/entities/enterprise-teacher.entity';
import { EnterpriseOwnerEntity } from '../../infrastructure/database/entities/enterprise-owner.entity';
import { HighTechApplicationEntity } from '../../infrastructure/database/entities/high-tech-application.entity';
import { HighTechMaterialService } from './high-tech/high-tech-material.service';
import { calculateHighTechProgress } from './high-tech/high-tech-progress';
import { completedHighTechSelfScore } from './high-tech/high-tech.model';

@Injectable()
export class EnterpriseArchiveService {
  constructor(
    @InjectRepository(EnterpriseTeacherEntity) private readonly teachers: Repository<EnterpriseTeacherEntity>,
    @InjectRepository(EnterpriseOwnerEntity) private readonly owners: Repository<EnterpriseOwnerEntity>,
    @InjectRepository(HighTechApplicationEntity) private readonly applications: Repository<HighTechApplicationEntity>,
    private readonly materials: HighTechMaterialService,
  ) {}

  // The caller supplies only enterprises returned by the existing access check.
  async enrich<T extends { id: string; enterpriseProjects: string[] }>(companies: T[]) {
    if (!companies.length) return [];
    const ids = companies.map((company) => company.id);
    const highTechIds = companies.filter((company) => company.enterpriseProjects.some((name) => name.includes('高新技术企业'))).map((company) => company.id);
    const [teachers, owners, applications] = await Promise.all([
      this.teachers.find({ where: { enterpriseId: In(ids), status: 1 }, relations: { teacher: true } }),
      this.owners.find({ where: { enterpriseId: In(ids), status: 1 }, relations: { user: true } }),
      highTechIds.length ? this.applications.find({ where: { enterpriseId: In(highTechIds) }, select: { enterpriseId: true, draftJson: true } }) : [],
    ]);
    const names = new Map<string, string>();
    for (const binding of owners) if (binding.user?.status === 1) names.set(String(binding.enterpriseId), binding.user.realName || binding.user.username);
    for (const binding of teachers) if (binding.teacher?.status === 1) names.set(String(binding.enterpriseId), binding.teacher.realName || binding.teacher.username);
    const drafts = new Map(applications.map((item) => [String(item.enterpriseId), item.draftJson]));
    const highTech = new Set(highTechIds);
    // Bound file metadata reads for large lists; never read uploaded file bodies.
    const results = [];
    for (let offset = 0; offset < companies.length; offset += 8) {
      results.push(...await Promise.all(companies.slice(offset, offset + 8).map(async (company) => {
        const draft = drafts.has(company.id) ? JSON.parse(drafts.get(company.id)!) : undefined;
        return {
        ...company,
        projectLeader: names.get(company.id) ?? '',
        highTechProgress: highTech.has(company.id)
          ? calculateHighTechProgress(draft, await this.materials.list(company.id))
          : null,
        highTechSelfScore: highTech.has(company.id) ? completedHighTechSelfScore(draft?.scores) : null,
      };
      })));
    }
    return results;
  }
}
