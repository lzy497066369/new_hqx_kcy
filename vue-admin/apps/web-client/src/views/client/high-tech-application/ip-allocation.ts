import type { HighTechDraft, HighTechIpItem, HighTechProject, IpAllocationPreview } from '#/api/client/high-tech';
import { newProject } from './model';
import { groupProjectRows, PROJECT_ROW_LIMIT, SHARED_PROJECT_FIELDS } from './project-rows';

import { PROJECT_IP_FIELDS as IP_FIELDS, projectIpValues } from './project-ip';
const occupied = (row: HighTechProject) => IP_FIELDS.some((key) => (row[key] ?? '').trim());

export function allocationSnapshot(draft: Pick<HighTechDraft, 'projects' | 'ipSummary'>) {
  return JSON.stringify({ projects: draft.projects, ipSummary: draft.ipSummary });
}

function alreadyAllocated(ip: HighTechIpItem, rows: HighTechProject[]) {
  return rows.some((row) => occupied(row) && (
    (ip.number.trim() && row.ipNumber.trim().toUpperCase().split(/[、,，;；\s]+/u).includes(ip.number.trim().toUpperCase())) ||
    (ip.patentNumber.trim() && row.authorizationNumber.trim().toUpperCase().split(/[、,，;；\s]+/u).includes(ip.patentNumber.trim().toUpperCase())) ||
    (ip.name.trim() && row.ipName.trim() === ip.name.trim())
  ));
}

/** Build an atomic replacement; no input rows are mutated, even on invalid previews. */
export function applyIpAllocation(draft: Pick<HighTechDraft, 'projects' | 'ipSummary'>, preview: IpAllocationPreview, snapshot: string): HighTechProject[] {
  if (allocationSnapshot(draft) !== snapshot) throw new Error('知识产权或项目详情已变化，请重新生成分配预览');
  // Vue wraps draft rows in proxies, which structuredClone cannot clone.
  const rows = draft.projects.map((row) => ({ ...row }));
  const used = new Set<string>();
  const groups = groupProjectRows(rows);
  for (const assignment of preview.assignments) {
    const ip = draft.ipSummary.find((item) => item.id === assignment.ipId);
    const group = groups.find((items) => items[0]?.id === assignment.projectId);
    if (!ip || !group || used.has(ip.id) || alreadyAllocated(ip, rows) || !ip.number.trim() || !ip.patentNumber.trim() || !ip.name.trim()) throw new Error('分配预览已失效或包含重复分配，请重新生成');
    used.add(ip.id);
    let target = group.find((row) => !occupied(row));
    if (!target) {
      if (rows.length >= PROJECT_ROW_LIMIT) throw new Error('项目详情超过200条，未应用任何分配');
      const anchor = group[0]!;
      target = newProject(rows, anchor.year ?? undefined);
      for (const key of SHARED_PROJECT_FIELDS) {
        if (key === 'year') target.year = anchor.year;
        else target[key] = anchor[key];
      }
      target.techField = anchor.techField;
      // Avoid normalization: existing RD/PS/achievement values must remain untouched.
      const existingNumbers = new Set(rows.map((row) => row.achievementNumber));
      let number = rows.length + 1;
      while (existingNumbers.has(`成果${String(number).padStart(2, '0')}`)) number++;
      target.achievementNumber = `成果${String(number).padStart(2, '0')}`;
      const last = group.at(-1)!;
      rows.splice(rows.indexOf(last) + 1, 0, target);
      group.push(target);
    }
    Object.assign(target, projectIpValues(ip));
  }
  return rows;
}
