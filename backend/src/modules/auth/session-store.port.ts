import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { SessionRecord } from '../../common/interfaces/session-record.interface';

export abstract class SessionStore {
  abstract createSession(user: CurrentUser): Promise<SessionRecord>;
  abstract findByAccessToken(accessToken: string): Promise<SessionRecord | null>;
  abstract findByRefreshToken(refreshToken: string): Promise<SessionRecord | null>;
  abstract revokeByAccessToken(accessToken: string): Promise<void>;
  abstract revokeByRefreshToken(refreshToken: string): Promise<void>;
  abstract rotateSession(refreshToken: string): Promise<SessionRecord | null>;
}
