export interface DeptInput {
  name?: string;
  parentId?: string | null;
  remark?: string | null;
  sortNum?: number | string;
  status?: number | string;
}
