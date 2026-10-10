import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import {
  buildUploadPublicUrl,
  createUploadFileName,
  ensureUploadAreaDirectory,
  getUploadAllowedExtensions,
  isUploadExtensionAllowed,
  normalizeUploadFileOriginalName,
  normalizeUploadOriginalName,
  normalizeStoredUploadPath,
  resolveStoredUploadAbsolutePath,
  resolveUploadArea,
  resolveUploadAreaFromRequest,
} from '../../common/utils/upload.util';

type StoredUploadFile = {
  filename: string;
  originalname: string;
  path?: string;
  size: number;
};

const MAX_STREAM_UPLOAD_BYTES = 20 * 1024 * 1024;

function createUploadInterceptorOptions() {
  return {
    fileFilter: (
      req: unknown,
      file: unknown,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      try {
        const request = req as Request;
        const uploadFile = normalizeUploadFileOriginalName(file as StoredUploadFile);
        const area = resolveUploadAreaFromRequest(request);

        if (!isUploadExtensionAllowed(area, uploadFile.originalname)) {
          callback(
            new BadRequestException(
              `file extension is not allowed, supported: ${getUploadAllowedExtensions(
                area,
              ).join(', ')}`,
            ) as unknown as Error,
            false,
          );
          return;
        }

        callback(null, true);
      } catch (error) {
        callback(error as Error, false);
      }
    },
    storage: diskStorage({
      destination: (
        req: unknown,
        _file: unknown,
        callback: (error: Error | null, value: string) => void,
      ) => {
        try {
          const area = resolveUploadAreaFromRequest(req as Request);
          callback(null, ensureUploadAreaDirectory(area));
        } catch (error) {
          callback(error as Error, '');
        }
      },
      filename: (
        _req: unknown,
        file: unknown,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const uploadFile = file as StoredUploadFile;
        callback(null, createUploadFileName(uploadFile.originalname));
      },
    }),
  };
}

@Controller('upload')
@UseGuards(AccessTokenGuard)
export class UploadController {
  @Put('stream/:module/:scene/:filename')
  async uploadStream(
    @Req() request: Request,
    @Param('module') moduleName: string,
    @Param('scene') sceneName: string,
    @Param('filename') filename: string,
  ) {
    const area = resolveUploadArea(moduleName, sceneName);
    const originalName = normalizeUploadOriginalName(filename);
    if (!isUploadExtensionAllowed(area, originalName)) {
      throw new BadRequestException(
        `file extension is not allowed, supported: ${getUploadAllowedExtensions(
          area,
        ).join(', ')}`,
      );
    }

    const safeName = createUploadFileName(originalName);
    const absoluteDirectory = ensureUploadAreaDirectory(area);
    const absolutePath = `${absoluteDirectory}/${safeName}`;
    const contentLength = Number(request.headers['content-length'] ?? 0);
    if (contentLength > MAX_STREAM_UPLOAD_BYTES) {
      throw new PayloadTooLargeException('file exceeds the 20 MiB upload limit');
    }

    try {
      await pipeline(
        request,
        this.createSizeLimitedStream(),
        createWriteStream(absolutePath),
      );
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }

    const storedPath = normalizeStoredUploadPath(absolutePath);
    if (!storedPath) {
      throw new BadRequestException('file path is invalid');
    }
    const fileStat = await stat(absolutePath);

    return {
      module: area.module,
      name: originalName,
      path: storedPath,
      scene: area.scene,
      size: fileStat.size,
      streamUrl: this.buildStreamPublicUrl(storedPath, request),
      url: buildUploadPublicUrl(storedPath, request),
    };
  }

  @Get('stream/*')
  async downloadStream(@Param() params: Record<string, string>, @Res() response: Response) {
    const pathValue = params[0] ?? params.path;
    const { absolutePath, storedPath } = resolveStoredUploadAbsolutePath(pathValue);
    if (!this.isSharedStreamPath(storedPath)) {
      throw new ForbiddenException(
        'This file must be accessed through its business authorization endpoint',
      );
    }
    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new NotFoundException('file does not exist');
    }
    const filename = basename(storedPath);

    response.setHeader('Content-Length', String(fileStat.size));
    response.setHeader('Content-Type', this.resolveContentType(filename));
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    await pipeline(createReadStream(absolutePath), response);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', createUploadInterceptorOptions()))
  uploadDefault(
    @UploadedFile() file: StoredUploadFile,
    @Req() request: Request,
    @Query('module') moduleName?: string,
    @Query('scene') sceneName?: string,
  ) {
    return this.buildUploadResponse(
      file,
      request,
      resolveUploadArea(moduleName, sceneName),
    );
  }

  @Post(':module/:scene')
  @UseInterceptors(FileInterceptor('file', createUploadInterceptorOptions()))
  uploadByArea(
    @UploadedFile() file: StoredUploadFile,
    @Req() request: Request,
    @Param('module') moduleName: string,
    @Param('scene') sceneName: string,
  ) {
    return this.buildUploadResponse(
      file,
      request,
      resolveUploadArea(moduleName, sceneName),
    );
  }

  private buildUploadResponse(
    file: StoredUploadFile | undefined,
    request: Request,
    area: ReturnType<typeof resolveUploadArea>,
  ) {
    if (!file?.path) {
      throw new BadRequestException('file upload failed');
    }

    const path = normalizeStoredUploadPath(file.path);
    if (!path) {
      throw new BadRequestException('file path is invalid');
    }

    return {
      module: area.module,
      name: file.originalname,
      path,
      scene: area.scene,
      size: file.size,
      url: buildUploadPublicUrl(path, request),
    };
  }

  private resolveContentType(filename: string): string {
    const extension = extname(filename).toLowerCase();
    const types: Record<string, string> = {
      '.gif': 'image/gif',
      '.jpeg': 'image/jpeg',
      '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain; charset=utf-8',
      '.webp': 'image/webp',
    };
    return types[extension] ?? 'application/octet-stream';
  }

  private isSharedStreamPath(storedPath: string): boolean {
    return (
      storedPath.startsWith('policy/') ||
      storedPath.startsWith('user/avatar/')
    );
  }

  private createSizeLimitedStream(): Transform {
    let receivedBytes = 0;
    return new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_STREAM_UPLOAD_BYTES) {
          callback(
            new PayloadTooLargeException('file exceeds the 20 MiB upload limit'),
          );
          return;
        }
        callback(null, chunk);
      },
    });
  }

  private buildStreamPublicUrl(storedPath: string, request: Request): string {
    const accessPath = `/upload/stream/${storedPath}`;
    const forwardedProtocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = request.get('x-forwarded-host')?.split(',')[0]?.trim();
    const protocol = forwardedProtocol || request.protocol;
    const host = forwardedHost || request.get('host') || '';
    return host ? `${protocol}://${host}${accessPath}` : accessPath;
  }
}
