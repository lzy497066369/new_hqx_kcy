import type { EnterpriseAccountInput } from '../shared/enterprise-account.service';

export interface EnterpriseOwnerInput extends EnterpriseAccountInput {
  enterpriseId?: string;
}
