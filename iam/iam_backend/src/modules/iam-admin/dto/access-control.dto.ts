import { ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class RoleDto {
  @IsString() @MaxLength(64) roleCode!: string;
  @IsString() @MaxLength(64) roleName!: string;
  @IsOptional() @IsString() @MaxLength(32) roleType?: string;
  @IsOptional() @IsString() @MaxLength(255) remark?: string | null;
  @IsOptional() @IsIn([0, 1]) status?: number;
}

export class PermissionDto {
  @IsString() @MaxLength(128) permissionCode!: string;
  @IsString() @MaxLength(128) permissionName!: string;
  @IsOptional() @IsString() @MaxLength(32) resourceType?: string;
  @IsOptional() @IsIn([0, 1]) status?: number;
}

export class MenuDto {
  @IsOptional() @IsString() @MaxLength(128) authCode?: string | null;
  @IsOptional() @IsString() @MaxLength(255) component?: string | null;
  @IsString() @MaxLength(128) menuName!: string;
  @IsOptional() @IsString() @MaxLength(32) menuType?: string;
  @IsOptional() meta?: Record<string, unknown> | null;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() @MaxLength(255) path?: string | null;
  @IsOptional() @IsString() @MaxLength(255) redirect?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsIn([0, 1]) status?: number;
}

export class IdListDto {
  @ArrayUnique() @IsArray() @IsString({ each: true }) permissionIds!: string[];
}

export class RoleListDto {
  @ArrayUnique() @IsArray() @IsString({ each: true }) roleIds!: string[];
}
