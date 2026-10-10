import type { EnterpriseAccountInput } from '../shared/enterprise-account.service';

export interface EnterpriseUserInput extends EnterpriseAccountInput {
  enterpriseId?: string;
  isDefault?: number | string;
}
