import { SetMetadata } from '@nestjs/common';

export const ALLOW_CROSS_APP_TOKEN_KEY = 'allowCrossAppToken';

export const AllowCrossAppToken = () =>
  SetMetadata(ALLOW_CROSS_APP_TOKEN_KEY, true);
