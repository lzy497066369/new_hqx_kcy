import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class OAuthTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  client_id!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  client_secret?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  code_verifier?: string;

  @IsIn(['authorization_code', 'refresh_token'])
  grant_type!: 'authorization_code' | 'refresh_token';

  @IsString()
  @IsOptional()
  @MaxLength(500)
  redirect_uri?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  refresh_token?: string;
}
