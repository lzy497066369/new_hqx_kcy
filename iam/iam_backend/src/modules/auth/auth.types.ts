export interface IamCurrentUser {
  avatar: string;
  expiresAt: Date;
  homePath: string;
  portal: 'admin';
  realName: string;
  roles: string[];
  userId: string;
  username: string;
}
