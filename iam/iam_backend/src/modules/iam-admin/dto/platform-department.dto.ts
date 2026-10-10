import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class PlatformDepartmentDto {
  @IsString()
  @MaxLength(64)
  deptCode!: string;

  @IsString()
  @MaxLength(128)
  deptName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  leaderUserId?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentId?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: null | string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsIn([0, 1])
  status?: number;
}
