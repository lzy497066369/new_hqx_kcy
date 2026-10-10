import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, posix, resolve, sep } from 'node:path';
import type { Request } from 'express';

type UploadAreaDefinition = {
  allowedExtensions: readonly string[];
  code: string;
  directory: string;
  module: string;
  scene: string;
};

const DEFAULT_UPLOAD_AREA_CODE = 'policy/file';
const HTTP_URL_PATTERN = /^https?:\/\//i;
const UPLOAD_ROOT_DIR = 'uploads';
const UPLOAD_URL_PREFIX = '/uploads/';

const DOCUMENT_EXTENSIONS = [
  '.doc',
  '.docx',
  '.pdf',
  '.ppt',
  '.pptx',
  '.rar',
  '.txt',
  '.xls',
  '.xlsx',
  '.zip',
  '.7z',
] as const;

const IMAGE_EXTENSIONS = [
  '.bmp',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
] as const;

const UPLOAD_AREAS = {
  'enterprise/attachment': {
    allowedExtensions: [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS],
    code: 'enterprise/attachment',
    directory: 'enterprise/attachment',
    module: 'enterprise',
    scene: 'attachment',
  },
  'enterprise/license': {
    allowedExtensions: [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS],
    code: 'enterprise/license',
    directory: 'enterprise/license',
    module: 'enterprise',
    scene: 'license',
  },
  'policy/file': {
    allowedExtensions: [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS],
    code: 'policy/file',
    directory: 'policy/file',
    module: 'policy',
    scene: 'file',
  },
  'policy/template': {
    allowedExtensions: [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS],
    code: 'policy/template',
    directory: 'policy/template',
    module: 'policy',
    scene: 'template',
  },
  'system/import': {
    allowedExtensions: [...DOCUMENT_EXTENSIONS],
    code: 'system/import',
    directory: 'system/import',
    module: 'system',
    scene: 'import',
  },
  'user/avatar': {
    allowedExtensions: IMAGE_EXTENSIONS,
    code: 'user/avatar',
    directory: 'user/avatar',
    module: 'user',
    scene: 'avatar',
  },
} as const satisfies Record<string, UploadAreaDefinition>;

function getDateSegments(date = new Date()) {
  return {
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear()),
  };
}

function getRequestValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

function normalizeAreaPart(value?: string): string | undefined {
  const text = value?.trim().toLowerCase();
  return text ? text : undefined;
}

export function getUploadRootAbsolutePath(): string {
  return join(process.cwd(), UPLOAD_ROOT_DIR);
}

export function ensureUploadRootDirectory(): string {
  const uploadRoot = getUploadRootAbsolutePath();
  if (!existsSync(uploadRoot)) {
    mkdirSync(uploadRoot, { recursive: true });
  }

  return uploadRoot;
}

export function createUploadFileName(originalName: string): string {
  const extension = extname(originalName || '').toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
}

export function normalizeUploadOriginalName(originalName: string): string {
  if (!originalName || [...originalName].some((character) => character.codePointAt(0)! > 0xff)) {
    return originalName;
  }

  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') || Buffer.from(decoded, 'utf8').toString('latin1') !== originalName
    ? originalName
    : decoded;
}

export function normalizeUploadFileOriginalName<T extends { originalname: string }>(file: T): T {
  file.originalname = normalizeUploadOriginalName(file.originalname);
  return file;
}

export function resolveUploadArea(
  moduleName?: string,
  sceneName?: string,
): UploadAreaDefinition {
  const module = normalizeAreaPart(moduleName);
  const scene = normalizeAreaPart(sceneName);
  const code = module && scene ? `${module}/${scene}` : DEFAULT_UPLOAD_AREA_CODE;
  const area = UPLOAD_AREAS[code as keyof typeof UPLOAD_AREAS];

  if (!area) {
    throw new BadRequestException(`upload area is not supported: ${code}`);
  }

  return area;
}

export function resolveUploadAreaFromRequest(request: Request): UploadAreaDefinition {
  const moduleName =
    getRequestValue(request.params?.module) ??
    getRequestValue(request.query?.module) ??
    'policy';
  const sceneName =
    getRequestValue(request.params?.scene) ??
    getRequestValue(request.query?.scene) ??
    'file';

  return resolveUploadArea(moduleName, sceneName);
}

export function buildUploadRelativeDirectory(
  area: UploadAreaDefinition,
  date = new Date(),
): string {
  const { month, year } = getDateSegments(date);
  return posix.join(area.directory, year, month);
}

export function ensureUploadAreaDirectory(
  area: UploadAreaDefinition,
  date = new Date(),
): string {
  const relativeDirectory = buildUploadRelativeDirectory(area, date);
  const absoluteDirectory = join(
    ensureUploadRootDirectory(),
    ...relativeDirectory.split('/'),
  );

  if (!existsSync(absoluteDirectory)) {
    mkdirSync(absoluteDirectory, { recursive: true });
  }

  return absoluteDirectory;
}

export function normalizeStoredUploadPath(value?: null | string): null | string {
  if (value === undefined || value === null) {
    return null;
  }

  let text = value.trim();
  if (!text) {
    return null;
  }

  text = text.replace(/\\/g, '/');

  if (HTTP_URL_PATTERN.test(text)) {
    try {
      text = new URL(text).pathname;
    } catch {
      return value.trim();
    }
  }

  const uploadsMarker = '/uploads/';
  const markerIndex = text.toLowerCase().lastIndexOf(uploadsMarker);
  if (markerIndex >= 0) {
    text = text.slice(markerIndex + uploadsMarker.length);
  } else if (text.toLowerCase().startsWith(`${UPLOAD_ROOT_DIR}/`)) {
    text = text.slice(UPLOAD_ROOT_DIR.length + 1);
  }

  while (text.startsWith('/')) {
    text = text.slice(1);
  }

  return text || null;
}

export function resolveStoredUploadAbsolutePath(value?: null | string): {
  absolutePath: string;
  storedPath: string;
} {
  const storedPath = normalizeStoredUploadPath(value);
  if (!storedPath) {
    throw new BadRequestException('file path is invalid');
  }

  const normalizedPath = posix.normalize(storedPath).replace(/^\/+/, '');
  if (
    normalizedPath === '..' ||
    normalizedPath.startsWith('../') ||
    normalizedPath.includes('/../')
  ) {
    throw new BadRequestException('file path is invalid');
  }

  const uploadRoot = ensureUploadRootDirectory();
  const absolutePath = resolve(uploadRoot, ...normalizedPath.split('/'));
  const rootPath = resolve(uploadRoot);
  if (absolutePath !== rootPath && !absolutePath.startsWith(`${rootPath}${sep}`)) {
    throw new BadRequestException('file path is invalid');
  }

  return {
    absolutePath,
    storedPath: normalizedPath,
  };
}

export function buildUploadAccessPath(value?: null | string): null | string {
  const storedPath = normalizeStoredUploadPath(value);
  if (!storedPath) {
    return null;
  }
  if (HTTP_URL_PATTERN.test(storedPath)) {
    return storedPath;
  }

  return `${UPLOAD_URL_PREFIX}${storedPath}`;
}

export function buildUploadPublicUrl(
  value: null | string | undefined,
  request?: Request,
): null | string {
  const accessPath = buildUploadAccessPath(value);
  if (!accessPath) {
    return null;
  }
  if (HTTP_URL_PATTERN.test(accessPath)) {
    return accessPath;
  }
  if (!request) {
    return accessPath;
  }

  const forwardedProtocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol || request.protocol;
  const host = forwardedHost || request.get('host') || '';

  return host ? `${protocol}://${host}${accessPath}` : accessPath;
}

export function isUploadExtensionAllowed(
  area: UploadAreaDefinition,
  originalName: string,
): boolean {
  const extension = extname(originalName || '').toLowerCase();
  return area.allowedExtensions.includes(extension);
}

export function getUploadAllowedExtensions(area: UploadAreaDefinition): string[] {
  return [...area.allowedExtensions];
}
