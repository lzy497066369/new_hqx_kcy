import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

import { ApiResponse } from '../interfaces/api-response.interface';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();

    // 确保所有 JSON 响应都带上 UTF-8 字符集
    if (response && !response.getHeader('Content-Type')) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'code' in (data as Record<string, unknown>) &&
          'data' in (data as Record<string, unknown>)
        ) {
          return data as unknown as ApiResponse<T>;
        }

        return {
          code: 0,
          data,
          message: '成功',
        };
      }),
    );
  }
}
