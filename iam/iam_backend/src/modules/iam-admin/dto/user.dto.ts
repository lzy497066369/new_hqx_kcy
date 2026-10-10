import { IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarPath?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(128)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsString()
  @MaxLength(64)
  realName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string | null;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1])
  status?: number;

  @IsString()
  @MaxLength(64)
  username!: string;
}
