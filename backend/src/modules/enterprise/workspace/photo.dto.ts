import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnterpriseWorkspacePhotoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photoDes?: null | string;

  @IsString()
  @MaxLength(2000)
  photoFiles!: string;

  @IsOptional()
  @IsInt()
  photoStatus?: null | number;

  @IsString()
  @MaxLength(255)
  photoTitle!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  psDate?: null | string;
}
