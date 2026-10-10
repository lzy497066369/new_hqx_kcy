export interface IamJwtClaims {
  app_code: string;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  name: string;
  home_path?: string;
  permissions: string[];
  preferred_username: string;
  roles: string[];
  sid: string;
  source_user_id?: string;
  sub: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  token_type: 'Bearer';
}
