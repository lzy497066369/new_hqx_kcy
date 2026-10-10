import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { formatDateTimeInBjt } from '../../../common/utils/date.util';
import { parseFlowDate } from '../../../common/utils/flow-date.util';
import {
  DeclarationPresetEntity,
  type DeclarationPresetType,
} from '../../../infrastructure/database/entities/declaration-preset.entity';
import { toNullableString, toStringId } from '../../system/shared/system.utils';
import { DeclarationPresetInput } from './dto';

const PRESET_TYPES: DeclarationPresetType[] = [
  'enterprise',
  'qualification',
  'material',
  'score',
  'flow',
];

@Injectable()
export class DeclarationPresetService {
  constructor(
    @InjectRepository(DeclarationPresetEntity)
    private readonly presetRepo: Repository<DeclarationPresetEntity>,
  ) {}

  async list(type?: string) {
    const presetType = type ? this.normalizeType(type) : undefined;
    const rows = await this.presetRepo.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
      ...(presetType ? { where: { presetType } } : {}),
    });
    return rows.map((row) => this.toItem(row));
  }

  async create(input: DeclarationPresetInput) {
    const presetType = this.normalizeType(input.presetType);
    this.validatePayload(presetType, input.payload);
    const entity = this.presetRepo.create({
      description: toNullableString(input.description),
      name: this.normalizeName(input.name),
      payloadJson: this.normalizePayload(input.payload),
      presetType,
      status: 'draft',
      version: this.normalizeVersion(input.version),
    });
    return this.toItem(await this.presetRepo.save(entity));
  }

  async update(id: string, input: DeclarationPresetInput) {
    const entity = await this.requirePreset(id);
    if (entity.status === 'published') {
      throw new BadRequestException('已发布预设不可直接修改，请新建版本后再发布');
    }
    if (input.name !== undefined) entity.name = this.normalizeName(input.name);
    if (input.version !== undefined) entity.version = this.normalizeVersion(input.version);
    if (input.description !== undefined) entity.description = toNullableString(input.description);
    if (input.payload !== undefined) {
      this.validatePayload(entity.presetType, input.payload);
      entity.payloadJson = this.normalizePayload(input.payload);
    }
    return this.toItem(await this.presetRepo.save(entity));
  }

  async publish(id: string) {
    const entity = await this.requirePreset(id);
    this.validatePayload(entity.presetType, this.parsePayload(entity.payloadJson));
    const published = await this.presetRepo.find({
      where: { name: entity.name, presetType: entity.presetType, status: 'published' },
    });
    await Promise.all(published.map((item) => {
      item.status = 'draft';
      return this.presetRepo.save(item);
    }));
    entity.status = 'published';
    return this.toItem(await this.presetRepo.save(entity));
  }

  private normalizeName(value: unknown): string {
    const name = String(value ?? '').trim();
    if (!name) throw new BadRequestException('预设名称不能为空');
    return name;
  }

  private normalizePayload(value: unknown): string {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('预设内容不能为空');
    }
    return JSON.stringify(value);
  }

  private validatePayload(presetType: DeclarationPresetType, value: unknown): void {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('预设内容不能为空');
    }
    if (presetType === 'qualification') {
      this.validateQualificationPayload(value);
      return;
    }
    if (presetType === 'material') {
      this.validateMaterialPayload(value);
      return;
    }
    if (presetType === 'score') {
      this.validateScorePayload(value);
      return;
    }
    if (presetType !== 'flow') return;
    const template = value as { nodes?: unknown };
    if (!template || typeof template !== 'object' || !Array.isArray(template.nodes) || template.nodes.length === 0) {
      throw new BadRequestException('流程模板至少需要配置一个节点');
    }
    const names = new Set<string>();
    const nodes = template.nodes as Array<Record<string, unknown>>;
    nodes.forEach((node, index) => {
      const code = String(node.code ?? '').trim();
      const name = String(node.name ?? '').trim();
      const timeRule = node.timeRule as Record<string, unknown> | undefined;
      const startDate = typeof timeRule?.startDate === 'string' ? timeRule.startDate : '';
      const endDate = typeof timeRule?.endDate === 'string' ? timeRule.endDate : '';
      if (!code || !name) throw new BadRequestException(`第 ${index + 1} 个流程节点的编码和名称不能为空`);
      if (names.has(name)) throw new BadRequestException('流程节点名称不能重复');
      names.add(name);
      if (timeRule?.mode !== 'date_range' || !this.isValidDate(startDate) || !this.isValidDate(endDate)) {
        throw new BadRequestException(`节点“${name}”必须配置有效的开始日期和截止日期`);
      }
      if (this.parseFlowDate(startDate)!.getTime() > this.parseFlowDate(endDate, true)!.getTime()) {
        throw new BadRequestException(`节点“${name}”的开始日期不能晚于截止日期`);
      }
    });
    const endNodes = nodes.filter((node) => node.type === 'end');
    if (endNodes.length !== 1 || nodes.at(-1)?.type !== 'end') {
      throw new BadRequestException('流程必须且只能有一个结束节点，并且结束节点必须位于最后');
    }
  }

  private validateQualificationPayload(value: unknown): void {
    if (Array.isArray(value) || !value || typeof value !== 'object') {
      throw new BadRequestException('准入条件必须包含规则对象');
    }
    const config = value as { mode?: unknown; rules?: unknown };
    if (!['all', 'any'].includes(String(config.mode ?? 'all')) || !Array.isArray(config.rules)) {
      throw new BadRequestException('准入条件的模式或规则格式不正确');
    }
    config.rules.forEach((rule) => {
      if (!rule || typeof rule !== 'object') throw new BadRequestException('准入条件规则格式不正确');
      const item = rule as Record<string, unknown>;
      if (item.type === 'certificate_exists') {
        if (!String(item.certificateType ?? '').trim()) {
          throw new BadRequestException('证书准入条件必须选择证书类型');
        }
        return;
      }
      if (item.type === 'certificate') {
        if (!String(item.code ?? item.name ?? '').trim()) {
          throw new BadRequestException('证书准入条件必须填写证书信息');
        }
        return;
      }
      if (
        item.type !== 'metric' ||
        !String(item.key ?? '').trim() ||
        !['eq', 'gt', 'gte', 'lt', 'lte'].includes(String(item.operator ?? '')) ||
        !Number.isFinite(Number(item.value))
      ) {
        throw new BadRequestException('指标准入条件格式不正确');
      }
    });
  }

  private validateMaterialPayload(value: unknown): void {
    if (!Array.isArray(value)) throw new BadRequestException('材料清单必须为数组');
    value.forEach((rule) => {
      if (!rule || typeof rule !== 'object') throw new BadRequestException('材料规则格式不正确');
      const item = rule as Record<string, unknown>;
      if (
        !String(item.itemName ?? '').trim() ||
        !String(item.moduleKey ?? '').trim() ||
        !String(item.tabKey ?? '').trim() ||
        !Number.isFinite(Number(item.requiredCount ?? 1)) ||
        Number(item.requiredCount ?? 1) < 1
      ) {
        throw new BadRequestException('材料规则缺少名称、资料位置或有效数量');
      }
    });
  }

  private validateScorePayload(value: unknown): void {
    if (Array.isArray(value) || !value || typeof value !== 'object') {
      throw new BadRequestException('评分模型必须包含规则对象');
    }
    const config = value as { items?: unknown; passScore?: unknown };
    if (!Array.isArray(config.items) || !Number.isFinite(Number(config.passScore)) || Number(config.passScore) < 0) {
      throw new BadRequestException('评分模型的通过分或规则格式不正确');
    }
    config.items.forEach((rule) => {
      if (!rule || typeof rule !== 'object') throw new BadRequestException('评分规则格式不正确');
      const item = rule as Record<string, unknown>;
      if (
        !String(item.label ?? '').trim() ||
        !String(item.source ?? '').trim() ||
        !['fixed', 'ladder', 'ratio', 'threshold'].includes(String(item.method ?? '')) ||
        !Number.isFinite(Number(item.maxScore)) ||
        Number(item.maxScore) < 0
      ) {
        throw new BadRequestException('评分规则缺少名称、来源、方法或有效分值');
      }
    });
  }

  private isValidDate(value: string): boolean {
    return parseFlowDate(value) !== null;
  }

  private parseFlowDate(value: string, endOfDay = false): Date | null {
    return parseFlowDate(value, endOfDay);
  }

  private normalizeType(value: unknown): DeclarationPresetType {
    const type = String(value ?? '').trim() as DeclarationPresetType;
    if (!PRESET_TYPES.includes(type)) throw new BadRequestException('预设类型不合法');
    return type;
  }

  private normalizeVersion(value: unknown): string {
    const version = String(value ?? 'v1').trim();
    if (!version) throw new BadRequestException('预设版本不能为空');
    return version;
  }

  private async requirePreset(id: string) {
    const entity = await this.presetRepo.findOne({ where: { id: toStringId(id) } });
    if (!entity) throw new NotFoundException('申报预设不存在');
    return entity;
  }

  private toItem(row: DeclarationPresetEntity) {
    return {
      createTime: formatDateTimeInBjt(row.createdAt),
      description: row.description,
      id: String(row.id),
      name: row.name,
      payload: this.parsePayload(row.payloadJson),
      presetType: row.presetType,
      status: row.status,
      updateTime: formatDateTimeInBjt(row.updatedAt),
      version: row.version,
    };
  }

  private parsePayload(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return {};
    }
  }
}
