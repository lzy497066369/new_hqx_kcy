import { Worker } from 'node:worker_threads';
import { BadRequestException } from '@nestjs/common';
import { HighTechIpItem, HighTechProject, IP_SUMMARY_FIELDS, PROJECT_FIELDS } from './high-tech.model';

export const IP_ALLOCATION_FIELDS = ['ipNumber', 'ipName', 'authorizationNumber', 'applicationDate', 'authorizationDate', 'ipType'] as const;
export type AllocationRound = 'spread' | 'append';
export interface AllocationGroup {
  id: string; rdNumber: string; rows: HighTechProject[]; period?: { start: number; end: number };
  existingCount: number; vacantCount: number; warning?: string;
}
export interface AllocationCandidate {
  ipId: string; projectId: string; rdNumber: string; timing: 'within' | 'after';
  round: AllocationRound; reason: string; similarNames: string[];
}

export function validDate(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return;
  return timestamp;
}

export function parseAllocationPeriod(value: string): AllocationGroup['period'] {
  const normalized = value.trim().replace(/年|月/gu, '-').replace(/日/gu, '');
  const match = /^(\d{4})[-./](\d{1,2})(?:[-./](\d{1,2}))?-?\s*(?:至|到|—+|–|~|～|-)\s*(\d{4})[-./](\d{1,2})(?:[-./](\d{1,2}))?-?$/u.exec(normalized);
  if (!match) return;
  const endpoint = (offset: number, end: boolean) => {
    const year = Number(match[offset]);
    const month = Number(match[offset + 1]);
    if (year < 1900 || year > 2100 || month < 1 || month > 12) return;
    const day = match[offset + 2] ? Number(match[offset + 2]) : end ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1;
    return validDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  };
  const start = endpoint(1, false);
  const end = endpoint(4, true);
  return start !== undefined && end !== undefined && start <= end ? { start, end } : undefined;
}

export function allocationTiming(applicationDate: string, period: NonNullable<AllocationGroup['period']>) {
  const date = validDate(applicationDate);
  if (date === undefined) return 'invalid' as const;
  if (date <= period.start) return 'manual' as const;
  return date <= period.end ? 'within' as const : 'after' as const;
}

export function occupied(row: HighTechProject) {
  return IP_ALLOCATION_FIELDS.some((key) => (row[key] ?? '').trim());
}

export function existingIp(ip: HighTechIpItem, rows: HighTechProject[]) {
  // Any stable identity match protects partial and historical manual allocations.
  return rows.some((row) => occupied(row) && (
    (ip.patentNumber.trim() && row.authorizationNumber.trim().toUpperCase().split(/[、,，;；\s]+/u).includes(ip.patentNumber.trim().toUpperCase())) ||
    (ip.number.trim() && row.ipNumber.trim().toUpperCase().split(/[、,，;；\s]+/u).includes(ip.number.trim().toUpperCase())) ||
    (ip.name.trim() && row.ipName.trim() === ip.name.trim())
  ));
}

export function allocationGroups(rows: HighTechProject[]): AllocationGroup[] {
  const groups = new Map<string, HighTechProject[]>();
  for (const row of rows) {
    const key = row.rdNumber.trim().toUpperCase() || row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    const periods = group.map((row) => parseAllocationPeriod(row.researchPeriod));
    const conflict = periods.some((period) => !period || period.start !== periods[0]?.start || period.end !== periods[0]?.end);
    const warning = !first.rdNumber.trim() ? 'RD编号缺失，需手动分配'
      : conflict ? '研发周期缺失、无效或同一RD周期不一致，需手动分配' : undefined;
    return {
      id: first.id, rdNumber: first.rdNumber, rows: group, period: warning ? undefined : periods[0], warning,
      existingCount: new Set(group.filter(occupied).flatMap((row) => {
        const numbers = row.ipNumber.trim().toUpperCase().split(/[、,，;；\s]+/u).filter(Boolean);
        return numbers.length ? numbers.map((number) => `number:${number}`) : [`other:${row.authorizationNumber.trim() || row.ipName.trim() || row.id}`];
      })).size,
      vacantCount: group.filter((row) => !occupied(row)).length,
    };
  });
}

export function allocationInput(input: unknown): { ipSummary: HighTechIpItem[]; projects: HighTechProject[] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('分配数据格式不正确');
  const body = input as Record<string, unknown>;
  const rows = (value: unknown, fields: readonly { key: string }[], project: boolean) => {
    if (!Array.isArray(value) || value.length > 200) throw new BadRequestException('知识产权和项目详情各最多200条');
    const ids = new Set<string>();
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new BadRequestException('行数据格式不正确');
      const source = entry as Record<string, unknown>;
      const row: Record<string, string | number | null> = {};
      for (const key of ['id', ...fields.map((field) => field.key)]) {
        const value = source[key];
        if (project && key === 'year') {
          if (value !== null && (!Number.isInteger(value) || Number(value) < 1900 || Number(value) > 2100)) throw new BadRequestException('项目年份不正确');
          row[key] = value as number | null;
        } else {
          if (typeof value !== 'string' || value.length > (key === 'id' ? 64 : 512)) throw new BadRequestException('分配字段须为有效文本');
          row[key] = value.trim();
        }
      }
      if (!row.id || ids.has(String(row.id))) throw new BadRequestException('行标识缺失或重复');
      ids.add(String(row.id));
      return row;
    });
  };
  return {
    ipSummary: rows(body.ipSummary, IP_SUMMARY_FIELDS, false) as unknown as HighTechIpItem[],
    projects: rows(body.projects, PROJECT_FIELDS, true) as unknown as HighTechProject[],
  };
}

export async function optimizeAllocation(candidates: AllocationCandidate[], groups: AllocationGroup[], rowCount: number, round: AllocationRound) {
  if (!candidates.length) return [];
  // Isolate CPU work so large inputs never block Nest's event loop.
  const result = await new Promise<number[]>((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const { solveAllocationFlow } = require(workerData.module);
      parentPort.postMessage(solveAllocationFlow(workerData.input));
    `, { eval: true, workerData: { input: { round, candidates, groups: groups.map(({ id, existingCount, vacantCount }) => ({ id, existingCount, vacantCount })), rowCount }, module: require.resolve('./high-tech-ip-allocation-flow') }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Allocation optimizer timed out')); }, 15_000);
    worker.once('message', (value) => { clearTimeout(timer); resolve(value); void worker.terminate(); });
    worker.once('error', (error) => { clearTimeout(timer); reject(error); });
    worker.once('exit', (code) => { clearTimeout(timer); if (code !== 0) reject(new Error('Allocation optimizer failed')); });
  });
  if (!Array.isArray(result) || result.some((index) => !Number.isInteger(index) || !candidates[index])) throw new Error('Invalid allocation result');
  const assigned = result.map((index) => candidates[index]);
  if (new Set(assigned.map((item) => item.ipId)).size !== assigned.length) throw new Error('Duplicate allocation');
  const newRows = groups.reduce((sum, group) => sum + Math.max(0, assigned.filter((item) => item.projectId === group.id).length - group.vacantCount), 0);
  if (rowCount + newRows > 200) throw new Error('Allocation row limit exceeded');
  return assigned;
}
