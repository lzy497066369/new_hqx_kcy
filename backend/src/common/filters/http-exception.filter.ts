import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : Array.isArray((payload as { message?: unknown }).message)
            ? ((payload as { message: string[] }).message ?? []).join(', ')
            : ((payload as { message?: string }).message ?? exception.message);

      console.error('[HTTP_EXCEPTION]', {
        message,
        path: host.switchToHttp().getRequest<{ url?: string }>()?.url,
        status,
      });

      response.status(status).json({
        code: status,
        data: null,
        message,
      });
      return;
    }

    console.error('[UNHANDLED_EXCEPTION]', exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      data: null,
      message: '服务器内部错误',
    });
  }
}
