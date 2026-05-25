import type { FinalizeUploadResponse, MediaPurpose, RequestUploadResponse } from '../types';

export type UploadProgressCallback = (pct: number) => void;

/**
 * PUT the file directly to the presigned URL (MinIO / S3).
 * Uses XMLHttpRequest so we can report granular progress.
 * The server never sees the upload — only the presigned URL reaches MinIO.
 */
export function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Presigned upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

type UploadAvatarOptions = {
  file: File;
  purpose?: MediaPurpose;
  onProgress?: UploadProgressCallback;
};

/**
 * Full two-step upload:
 * 1. Request a presigned URL from the BFF.
 * 2. PUT the file directly to MinIO.
 * 3. Call finalize so the Media Service marks the asset as ready.
 * Returns the finalized asset.
 */
export async function uploadAsset({
  file,
  purpose = 'avatar',
  onProgress,
}: UploadAvatarOptions): Promise<FinalizeUploadResponse> {
  // Step 1 — request presigned URL
  const requestRes = await fetch('/api/media/uploads/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      purpose,
    }),
  });

  if (!requestRes.ok) {
    throw new Error(`Failed to request upload slot (${requestRes.status})`);
  }

  const { assetId, uploadUrl } = (await requestRes.json()) as RequestUploadResponse;

  // Step 2 — upload directly to MinIO (never touches our server again)
  await uploadToPresignedUrl(uploadUrl, file, onProgress);

  // Step 3 — finalize
  const finalizeRes = await fetch(`/api/media/uploads/${assetId}/finalize`, {
    method: 'POST',
  });

  if (!finalizeRes.ok) {
    throw new Error(`Failed to finalize upload (${finalizeRes.status})`);
  }

  return finalizeRes.json() as Promise<FinalizeUploadResponse>;
}
