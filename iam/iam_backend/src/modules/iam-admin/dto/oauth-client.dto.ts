import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OAuthClientDto {
  @IsInt()
  @IsOptional()
  @Min(300)
  accessTokenTtl?: number;

  @IsString()
  @MaxLength(128)
  clientId!: string;

  @IsIn(['confidential', 'public'])
  clientType!: 'confidential' | 'public';

  @ArrayMinSize(1)
  @IsArray()
  @IsIn(['authorization_code', 'refresh_token'], { each: true })
  grantTypes!: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  postLogoutRedirectUris?: string[];

  @ArrayMinSize(1)
  @IsArray()
  @IsString({ each: true })
  redirectUris!: string[];

  @IsInt()
  @IsOptional()
  @Min(3600)
  refreshTokenTtl?: number;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  secret?: string;

  @IsIn([0, 1])
  @IsOptional()
  status?: number;
}
