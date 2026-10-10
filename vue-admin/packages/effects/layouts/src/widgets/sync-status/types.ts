interface SyncStatusItem {
  currentStep?: null | string;
  description: string;
  id: number | string;
  link?: string;
  progress?: number;
  query?: Record<string, any>;
  state?: Record<string, any>;
  status: string;
  time: string;
  title: string;
  [key: string]: any;
}

export type { SyncStatusItem };
