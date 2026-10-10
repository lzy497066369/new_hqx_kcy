import { SetMetadata } from '@nestjs/common';

export const OPERATION_LOG_KEY = 'operation_log';

export type OperationLogMeta = {
  action: string;
  module: string;
};

export const OperationLog = (meta: OperationLogMeta) =>
  SetMetadata(OPERATION_LOG_KEY, meta);
