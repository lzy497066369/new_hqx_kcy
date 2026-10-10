import type { DeclarationPresetType } from '../../../infrastructure/database/entities/declaration-preset.entity';

export interface DeclarationPresetInput {
  description?: null | string;
  name?: string;
  payload?: unknown;
  presetType?: DeclarationPresetType;
  version?: string;
}
