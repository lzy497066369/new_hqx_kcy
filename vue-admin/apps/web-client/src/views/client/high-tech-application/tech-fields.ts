import type { HighTechFieldOption, HighTechProject } from '#/api/client/high-tech';

export function projectPatentNames(projects: HighTechProject[]) {
  return [...new Set(projects.map((row) => row.ipName.trim()).filter(Boolean))];
}

export function matchesTechField(input: string, option?: { label?: unknown }) {
  const label = String(option?.label ?? '').toLocaleLowerCase().replace(/\s/gu, '');
  return input.toLocaleLowerCase().trim().split(/\s+/u).every((word) => label.includes(word));
}

export function techFieldOptions(catalog: HighTechFieldOption[], recommendations: HighTechFieldOption[]) {
  const option = (field: HighTechFieldOption) => ({ value: field.id, label: field.label, title: field.label });
  const recommendedIds = new Set(recommendations.map((field) => field.id));
  return [
    ...(recommendations.length ? [{ label: '模型推荐', options: recommendations.map(option) }] : []),
    { label: '全部领域', options: catalog.filter((field) => !recommendedIds.has(field.id)).map(option) },
  ];
}
