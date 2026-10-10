import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';

export class UserPlatformDepartmentDto {
  @IsBoolean()
  isPrimary!: boolean;

  @IsIn([0, 1])
  status!: number;

  @IsString()
  @MaxLength(64)
  userId!: string;
}
