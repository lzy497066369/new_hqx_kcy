import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const AI_SCENES = [
  'chat_test',
  'search_health_check',
  'policy_parse',
  'policy_collect_official_search',
  'policy_collect_search',
  'policy_file_draft_parse',
  'policy_project_generate',
  'enterprise_check',
  'project_match',
  'material_check',
  'review_assist',
  'gaoxin_score_explain',
] as const;

export type AiScene = (typeof AI_SCENES)[number];

export class CreateAiTaskDto {
  @IsIn(AI_SCENES)
  scene!: AiScene;

  @IsString()
  @IsNotEmpty()
  bizType!: string;

  @IsString()
  @IsNotEmpty()
  bizId!: string;
}

export class UpdateAiResultStatusDto {
  @IsOptional()
  @IsString()
  remark?: string;
}

export class AiChatMessageDto {
  @IsIn(['assistant', 'system', 'user'])
  role!: 'assistant' | 'system' | 'user';

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class CreateAiChatTestDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  messages?: AiChatMessageDto[];

  @IsOptional()
  @IsString()
  model?: string;
}
