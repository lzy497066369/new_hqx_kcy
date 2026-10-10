interface BasicOption {
  label: string;
  value: string;
}

type SelectOption = BasicOption;

type TabOption = BasicOption;

interface BasicUserInfo {
  avatar?: string;
  email?: string | null;
  homePath?: string;
  introduction?: string | null;
  phone?: string | null;
  realName: string;
  roleNames?: string[];
  roles?: string[];
  userId: string | number;
  username: string;
}

type ClassType =
  | Array<ClassType>
  | boolean
  | null
  | object
  | string
  | undefined;

export type { BasicOption, BasicUserInfo, ClassType, SelectOption, TabOption };
