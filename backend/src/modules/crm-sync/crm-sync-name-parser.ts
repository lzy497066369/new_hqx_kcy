export type CrmExecutionNameParseResult = {
  intellectualPropertyCount: null | number;
  projectCodes: string[];
};

const GAOXIN_CODE = 'QUAL_HIGH_TECH_ENTERPRISE_NATIONAL';
const TECH_SME_CODE = 'QUAL_TECH_SME_PROVINCIAL';

export function parseCrmExecutionOrderName(
  executionOrderName: string,
): CrmExecutionNameParseResult {
  const value = executionOrderName.replace(/\s+/gu, '');
  const projectCodes: string[] = [];

  if (/国家高新技术企业|高新技术企业.*申报|高企.*申报/iu.test(value)) {
    projectCodes.push(GAOXIN_CODE);
  }
  if (/科小.*(?:入库|申报)|科技型中小企业/iu.test(value)) {
    projectCodes.push(TECH_SME_CODE);
  }

  const propertyMatch = value.match(
    /(?:知识产权(?:数量)?[：:]?\s*(\d+)\s*(?:件|项|个)?|(?:(\d+)\s*(?:件|项|个)\s*知识产权))/u,
  );
  const intellectualPropertyCount = Number(propertyMatch?.[1] ?? propertyMatch?.[2]);

  return {
    intellectualPropertyCount:
      Number.isInteger(intellectualPropertyCount) && intellectualPropertyCount >= 0
        ? intellectualPropertyCount
        : null,
    projectCodes,
  };
}

export const CRM_PROJECT_CODES = {
  GAOXIN: GAOXIN_CODE,
  TECH_SME: TECH_SME_CODE,
} as const;
