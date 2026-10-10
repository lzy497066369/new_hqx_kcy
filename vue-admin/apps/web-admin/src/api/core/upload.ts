import { requestClient } from '#/api/request';
import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

interface UploadFileParams {
  file: File;
  onError?: (error: Error) => void;
  onProgress?: (progress: { percent: number }) => void;
  onSuccess?: (data: any, file: File) => void;
}

export interface StreamUploadResponse {
  module: string;
  name: string;
  path: string;
  scene: string;
  size: number;
  streamUrl: string;
  url: string;
}

function getApiBaseUrl() {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  return apiURL.replace(/\/$/, '');
}

function getAccessToken() {
  return useAccessStore().accessToken;
}

export async function upload_file({
  file,
  onError,
  onProgress,
  onSuccess,
}: UploadFileParams) {
  try {
    onProgress?.({ percent: 0 });

    const data = await requestClient.upload('/upload', { file });

    onProgress?.({ percent: 100 });
    onSuccess?.(data, file);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export function streamUploadFile({
  file,
  module = 'policy',
  onError,
  onProgress,
  onSuccess,
  scene = 'file',
}: UploadFileParams & { module?: string; scene?: string }) {
  const xhr = new XMLHttpRequest();
  const filename = encodeURIComponent(file.name || 'upload.bin');
  const url = `${getApiBaseUrl()}/upload/stream/${module}/${scene}/${filename}`;

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) {
      return;
    }
    onProgress?.({ percent: Math.round((event.loaded / event.total) * 100) });
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const payload = JSON.parse(xhr.responseText || '{}') as {
        data?: StreamUploadResponse;
      } & StreamUploadResponse;
      onProgress?.({ percent: 100 });
      onSuccess?.(payload.data ?? payload, file);
      return;
    }
    onError?.(new Error(xhr.responseText || `upload failed: ${xhr.status}`));
  };
  xhr.onerror = () => {
    onError?.(new Error('upload failed'));
  };
  xhr.open('PUT', url);
  const accessToken = getAccessToken();
  if (accessToken) {
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
  }
  xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
  onProgress?.({ percent: 0 });
  xhr.send(file);

  return {
    abort() {
      xhr.abort();
    },
  };
}

export function buildUploadStreamUrl(path: string) {
  const url = new URL(
    `${getApiBaseUrl()}/upload/stream/${path.replace(/^\/+/, '')}`,
    window.location.origin,
  );
  const accessToken = getAccessToken();
  if (accessToken) {
    url.searchParams.set('access_token', accessToken);
  }
  return url.toString();
}
