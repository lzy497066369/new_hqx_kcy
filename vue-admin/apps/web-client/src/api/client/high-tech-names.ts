export interface IpNameAnalysis {
  ipId: string;
  technicalObject: string;
  coreFunction: string;
  technicalProblem: string;
  technicalSolution: string;
  applicationScenario: string;
  technicalDirection: string;
  keywords: string[];
  confidence: 'low' | 'medium';
}
export interface NameGeneration {
  version: 2 | 3;
  generatedAt: string;
  status: 'generated';
  evidenceSource: 'ip_and_rd_names';
  analyses: IpNameAnalysis[];
  themes: { id: string; name: string; ipIds: string[]; reason: string }[];
  rds: { id: string; name: string; themeIds: string[]; ipIds: string[]; referenceRdIds: string[]; reason: string }[];
  achievements: { id: string; name: string; rdId: string; ipIds: string[]; reason: string }[];
  products: { id: string; name: string; achievementIds: string[]; reason: string }[];
  mappings: { projectId: string; achievementId: string; productId: string }[];
  warnings: string[];
}
