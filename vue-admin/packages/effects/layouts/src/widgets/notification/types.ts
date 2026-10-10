interface NotificationItem {
  actionText?: string;
  avatar: string;
  date: string;
  id: number | string;
  isRead?: boolean;
  level?: 'high' | 'low' | 'medium';
  link?: string;
  message: string;
  metaText?: string;
  query?: Record<string, any>;
  state?: Record<string, any>;
  title: string;
  [key: string]: any;
}

export type { NotificationItem };
