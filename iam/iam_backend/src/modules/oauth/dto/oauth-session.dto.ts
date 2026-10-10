import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class OAuthSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;
}
