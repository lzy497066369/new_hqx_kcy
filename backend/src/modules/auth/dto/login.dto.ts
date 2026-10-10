import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { AuthPortal } from '../auth.types';
import { AUTH_PORTALS } from '../auth.types';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString({ message: '账号格式不正确' })
  @MinLength(2, { message: '账号长度不能少于 2 位' })
  @MaxLength(64, { message: '账号长度不能超过 64 位' })
  username!: string;

  @ApiProperty({ example: '123456' })
  @IsString({ message: '密码格式不正确' })
  @MinLength(4, { message: '密码长度不能少于 4 位' })
  @MaxLength(128, { message: '密码长度不能超过 128 位' })
  password!: string;

  @ApiProperty({ enum: AUTH_PORTALS, example: 'admin', required: false })
  @IsOptional()
  @IsIn(AUTH_PORTALS, { message: '登录入口不合法' })
  portal?: AuthPortal;

  @ApiProperty({ example: 'kjqb', required: false })
  @IsOptional()
  @IsString({ message: '系统编码格式不正确' })
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/, {
    message: '系统编码仅支持小写字母、数字、中划线和下划线',
  })
  appCode?: string;
}
