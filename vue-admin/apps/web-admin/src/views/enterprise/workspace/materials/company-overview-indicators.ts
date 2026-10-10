import type { MaterialSectionTarget } from './material-section';

interface HighTechIndicators {
  financialYears: number;
  intellectualPropertyCount: number;
  productServiceCount: number;
  researchEmployeeCount: number;
  researchProjectCount: number;
  transformationCount: number;
}

interface CompanyOverviewIndicator {
  label: string;
  target: MaterialSectionTarget;
  value: number;
}

export function createCompanyOverviewIndicators(
  indicators: HighTechIndicators,
): CompanyOverviewIndicator[] {
  return [
    { label: '财务年度', target: { section: 'finance', tab: 'financial' }, value: indicators.financialYears },
    { label: '科技人员', target: { section: 'employee' }, value: indicators.researchEmployeeCount },
    { label: 'IP 数量', target: { section: 'intellectual_property', tab: 'ip' }, value: indicators.intellectualPropertyCount },
    { label: 'RD 数量', target: { section: 'intellectual_property', tab: 'rd' }, value: indicators.researchProjectCount },
    { label: 'PS 数量', target: { section: 'intellectual_property', tab: 'ps' }, value: indicators.productServiceCount },
    { label: '成果转化', target: { section: 'intellectual_property', tab: 'transformation' }, value: indicators.transformationCount },
  ];
}
