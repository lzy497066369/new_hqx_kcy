import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Zhang San' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  realName?: string;

  @ApiPropertyOptional({ example: 'zhangsan' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @ApiPropertyOptional({ example: '13800138000' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: null | string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  email?: null | string;

  @ApiPropertyOptional({ example: 'user/avatar/2026/07/avatar.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: null | string;

  @ApiPropertyOptional({ example: 'Responsible for project materials.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  introduction?: null | string;
}

export class UpdatePasswordDto {
  @ApiPropertyOptional({ example: '123456' })
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  oldPassword!: string;

  @ApiPropertyOptional({ example: 'new-password' })
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  newPassword!: string;
}
