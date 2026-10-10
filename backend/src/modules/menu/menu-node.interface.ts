export interface MenuNode {
  authCode?: string;
  children?: MenuNode[];
  component?: string;
  id: string;
  parentId?: string | null;
  meta: {
    hideChildrenInMenu?: boolean;
    hideInMenu?: boolean;
    icon?: string;
    order?: number;
    title: string;
  };
  name: string;
  path: string;
  redirect?: string;
  status: number;
  type: 'catalog' | 'menu' | 'button';
}
