import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class OAuthRevokeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  client_id!: string;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  client_secret?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
