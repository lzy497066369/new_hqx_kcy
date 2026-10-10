import { CurrentUser } from './current-user.interface';

export interface SessionRecord {
  accessToken: string;
  createdAt: string;
  expiresAt: string;
  refreshExpiresAt: string;
  refreshToken: string;
  sessionId?: string;
  user: CurrentUser;
}
