import { Column, Entity } from 'typeorm';

import { IamBaseEntity } from './iam-base.entity';

@Entity('iam_oauth_client')
export class IamOAuthClientEntity extends IamBaseEntity {
  @Column({ name: 'app_code', type: 'varchar', length: 64 })
  appCode!: string;

  @Column({ name: 'client_id', type: 'varchar', length: 128, unique: true })
  clientId!: string;

  @Column({ name: 'client_secret_hash', type: 'varchar', length: 255, nullable: true })
  clientSecretHash!: null | string;

  @Column({ name: 'client_type', type: 'varchar', length: 32, default: 'public' })
  clientType!: 'confidential' | 'public';

  @Column({ name: 'grant_types', type: 'json' })
  grantTypes!: string[];

  @Column({ name: 'redirect_uris', type: 'json' })
  redirectUris!: string[];

  @Column({ name: 'post_logout_redirect_uris', type: 'json', nullable: true })
  postLogoutRedirectUris!: null | string[];

  @Column({ name: 'access_token_ttl', type: 'int', default: 1800 })
  accessTokenTtl!: number;

  @Column({ name: 'refresh_token_ttl', type: 'int', default: 2_592_000 })
  refreshTokenTtl!: number;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;
}
