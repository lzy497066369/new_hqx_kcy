import dayjs from 'dayjs';

export function extractListData<T>(
  value: T[] | { items?: T[]; list?: T[] } | undefined,
) {
  if (Array.isArray(value)) {
    return value;
  }
  return value?.items ?? value?.list ?? [];
}

export function extractUploadedFileUrl(payload: unknown) {
  if (typeof payload === 'string' && payload) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const directUrl = (payload as { url?: unknown }).url;
    if (typeof directUrl === 'string' && directUrl) {
      return directUrl;
    }

    const nestedUrl = (payload as { data?: { url?: unknown } }).data?.url;
    if (typeof nestedUrl === 'string' && nestedUrl) {
      return nestedUrl;
    }
  }

  throw new Error('上传成功，但未返回文件地址');
}

export function formatMediaDate(value?: null | string) {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return value;
  }

  return value.includes(':')
    ? parsed.format('YYYY-MM-DD HH:mm')
    : parsed.format('YYYY-MM-DD');
}

export function normalizeMediaUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function triggerDownload(url: string, name: string) {
  if (!url) {
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.target = '_blank';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
