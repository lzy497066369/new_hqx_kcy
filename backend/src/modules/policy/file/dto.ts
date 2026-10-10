export interface RegionPolicyFileInput {
  applicationLevel?: string | null;
  conditionText?: string | null;
  content?: string | null;
  endDate?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  materialText?: string | null;
  officialFileUrl?: string | null;
  ownerUserId?: string | null;
  policyCategory?: string | null;
  projectId?: string;
  regionId?: string | null;
  remark?: string | null;
  startDate?: string | null;
  status?: 'incomplete' | 'draft' | 'published' | 'archived' | 'expired';
  subsidyAmountMax?: string | null;
  subsidyAmountMin?: string | null;
  subsidyText?: string | null;
  targetObjects?: string | null;
  templateFileId?: string | null;
  templateFileName?: string | null;
  title?: string;
}
