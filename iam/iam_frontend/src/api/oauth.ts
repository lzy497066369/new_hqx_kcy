import { requestClient } from '#/api/request';

export async function createSsoSessionApi(data: { password: string; username: string }) {
  return requestClient.post<{ expiresAt: string; user: { realName: string; username: string } }>('/oauth/session', data, { withCredentials: true });
}
