import { Injectable } from '@nestjs/common';

import type { CurrentUser } from '../../../common/interfaces/current-user.interface';
import { AiService } from '../../ai/ai.service';
import type { AiPolicyCollectSearchSource } from '../../ai/ai.types';

interface PolicySearchInput {
  bizId: string;
  jobId: string;
  jobName: string;
  keywords: string[];
  officialDomainRules?: null | string;
  policyCategory: string;
  policyCategoryName: string;
  projectName: string;
  publishDateEnd: string;
  publishDateStart: string;
  regionScope: string;
  regionName: string;
  systemDate: string;
}

interface PolicySearchOutput {
  rawResultCount: number;
  results: AiPolicyCollectSearchSource[];
  searchTaskId: string;
  queries: string[];
  warnings: string[];
}

@Injectable()
export class PolicySearchProvider {
  constructor(private readonly aiService: AiService) {}

  async searchOfficialPolicies(
    input: PolicySearchInput,
    user?: CurrentUser,
  ): Promise<PolicySearchOutput> {
    const queries = this.buildQueries(input);
    const aiResult = await this.aiService.runPolicyCollectOfficialSearch(
      {
        bizId: input.bizId,
        jobId: input.jobId,
        jobName: input.jobName,
        keywords: input.keywords,
        officialDomainRules: input.officialDomainRules,
        policyCategory: input.policyCategory,
        policyCategoryName: input.policyCategoryName,
        projectName: input.projectName,
        publishDateEnd: input.publishDateEnd,
        publishDateStart: input.publishDateStart,
        queries,
        regionName: input.regionName,
        regionScope: input.regionScope,
        systemDate: input.systemDate,
      },
      user,
    );
    const officialResults = aiResult.results
      .filter((item) => this.isOfficialLikely(item, input))
      .slice(0, 30);

    return {
      queries,
      rawResultCount: aiResult.results.length,
      results: officialResults,
      searchTaskId: aiResult.taskId,
      warnings: aiResult.warnings,
    };
  }

  private buildQueries(input: PolicySearchInput): string[] {
    const baseTerms = [
      input.projectName,
      this.resolveYearRangeTerm(input),
      input.regionScope === 'all' ? '' : input.regionName,
      ...input.keywords,
    ].filter(Boolean);
    const term = [...new Set(baseTerms)].join(' ');
    const regionTerm = input.regionScope === 'all' ? '' : input.regionName;
    const queries = [
      ...this.resolveCategoryQueries(input, term, regionTerm),
      ...this.resolveRegionOfficialQueries(input),
      ...this.resolveConfiguredDomainQueries(input),
    ];

    return [...new Set(queries.map((item) => item.trim()).filter(Boolean))].slice(
      0,
      10,
    );
  }

  private resolveCategoryQueries(
    input: PolicySearchInput,
    term: string,
    regionTerm: string,
  ): string[] {
    if (input.policyCategory === 'reward') {
      return [
        `site:gov.cn ${term} 奖补 政策 官方`,
        `site:gov.cn ${input.projectName} ${this.resolveYearRangeTerm(input)} 奖补 政策 官方`,
        `${term} 补贴 奖励 兑现 通知 官方`,
        `${term} 扶持资金 资助标准 政府官网`,
        `${input.projectName} ${regionTerm} ${this.resolveYearRangeTerm(input)} 奖励 补助 申报 政策`,
      ];
    }
    if (input.policyCategory === 'publicity') {
      return [
        `site:innocom.gov.cn ${input.projectName} ${this.resolveYearRangeTerm(input)} 公示 名单`,
        `site:gov.cn ${input.projectName} ${this.resolveYearRangeTerm(input)} 公示 名单`,
        `${term} 公示 名单 官方`,
        `${term} 拟认定 公示`,
        `${term} 通过名单 备案名单`,
      ];
    }
    if (input.policyCategory === 'notice') {
      return [
        `site:gov.cn ${term} 申报 通知`,
        `site:gov.cn ${input.projectName} ${this.resolveYearRangeTerm(input)} 申报 通知`,
        `${term} 申报 通知 官方`,
        `${term} 组织申报 通知`,
        `${term} 申报指南 材料要求`,
      ];
    }
    return [
      `site:gov.cn ${term} 政策 文件 通知`,
      `site:gov.cn ${input.projectName} ${this.resolveYearRangeTerm(input)} 政策 文件 通知`,
      `${term} 政策 文件 官方`,
      `${term} 管理办法 官方`,
      `${input.projectName} ${regionTerm} 政策 政府官网`,
    ];
  }

  private resolveRegionOfficialQueries(input: PolicySearchInput): string[] {
    const dateRangeTerm = this.resolveYearRangeTerm(input);
    const queries: string[] = [];
    if (input.regionName.includes('浙江') || input.regionName.includes('杭州')) {
      queries.push(
        `site:kjt.zj.gov.cn ${input.projectName} 浙江 ${dateRangeTerm} 政策 文件 通知`,
        `site:zj.gov.cn ${input.projectName} 浙江 ${dateRangeTerm} 政策 文件 通知`,
      );
    }
    if (input.regionName.includes('杭州')) {
      queries.push(
        `site:st.hangzhou.gov.cn ${input.projectName} 杭州 ${dateRangeTerm} 政策 文件 通知`,
        `site:hangzhou.gov.cn ${input.projectName} 杭州 ${dateRangeTerm} 政策 文件 通知`,
      );
    }
    return queries;
  }

  private resolveConfiguredDomainQueries(input: PolicySearchInput): string[] {
    const domains = (input.officialDomainRules ?? '').match(
      /(?:[a-z0-9-]+\.)+[a-z]{2,}/gi,
    );
    if (!domains?.length) {
      return [];
    }
    return [...new Set(domains)].map(
      (domain) =>
        `site:${domain} ${input.projectName} ${input.regionName} ${this.resolveYearRangeTerm(input)} 政策 文件 通知`,
    );
  }

  private resolveYearRangeTerm(input: PolicySearchInput): string {
    return [
      ...new Set([input.publishDateStart.slice(0, 4), input.publishDateEnd.slice(0, 4)]),
    ]
      .filter(Boolean)
      .join(' ');
  }

  private isOfficialLikely(
    item: AiPolicyCollectSearchSource,
    input: PolicySearchInput,
  ): boolean {
    if (!this.shouldKeepByPublishDate(item.publishDate, input)) {
      return false;
    }
    if (this.isOfficialUrl(item.url)) {
      return true;
    }
    return item.officialLikely === true;
  }

  private shouldKeepByPublishDate(
    value: null | string | undefined,
    input: PolicySearchInput,
  ): boolean {
    if (!value) {
      return true;
    }
    const date = this.parseDate(value);
    const start = this.parseDate(input.publishDateStart);
    const end = this.parseDate(input.publishDateEnd);
    if (!date || !start || !end) {
      return true;
    }
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  }

  private parseDate(value: string): Date | null {
    const match = value.match(/\b(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  private isOfficialUrl(value: string): boolean {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return (
        hostname === 'gov.cn' ||
        hostname.endsWith('.gov.cn') ||
        hostname === 'innocom.gov.cn' ||
        hostname.endsWith('.innocom.gov.cn')
      );
    } catch {
      return false;
    }
  }
}
