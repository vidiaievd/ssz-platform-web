import type {
  AssetResponse,
  FinalizeUploadResponse,
  MediaPurpose,
  RequestUploadBody,
  RequestUploadResponse,
} from '../types';

export type UploadProgressCallback = (pct: number) => void;

// Only 'profile_avatar' is special-cased by the media-service (public bucket);
// everything else lands in the private bucket behind a pre-signed GET URL.
const PURPOSE_TO_ENTITY_TYPE: Record<MediaPurpose, string> = {
  avatar: 'profile_avatar',
  lesson: 'lesson_asset',
  exercise: 'exercise_asset',
};

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
 * Full upload flow:
 * 1. Request a presigned URL from the BFF.
 * 2. PUT the file directly to MinIO.
 * 3. Call finalize so the Media Service marks the asset as uploaded.
 * 4. Fetch the finalized asset (finalize itself returns 204 No Content).
 */
export async function uploadAsset({
  file,
  purpose = 'avatar',
  onProgress,
}: UploadAvatarOptions): Promise<FinalizeUploadResponse> {
  // Step 1 — request presigned URL
  const body: RequestUploadBody = {
    mimeType: file.type,
    sizeBytes: file.size,
    originalFilename: file.name,
    entityType: PURPOSE_TO_ENTITY_TYPE[purpose],
  };

  const requestRes = await fetch('/api/media/uploads/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!requestRes.ok) {
    throw new Error(`Failed to request upload slot (${requestRes.status})`);
  }

  const { assetId, uploadUrl } = (await requestRes.json()) as RequestUploadResponse;

  // Step 2 — upload directly to MinIO (never touches our server again)
  await uploadToPresignedUrl(uploadUrl, file, onProgress);

  // Step 3 — finalize (204 No Content — the asset itself isn't in the body)
  const finalizeRes = await fetch(`/api/media/uploads/${assetId}/finalize`, {
    method: 'POST',
  });

  if (!finalizeRes.ok) {
    throw new Error(`Failed to finalize upload (${finalizeRes.status})`);
  }

  // Step 4 — fetch the finalized asset (has its real, playable/displayable URL)
  const assetRes = await fetch(`/api/media/assets/${assetId}`);

  if (!assetRes.ok) {
    throw new Error(`Failed to load uploaded asset (${assetRes.status})`);
  }

  const asset = (await assetRes.json()) as AssetResponse;

  return {
    asset: {
      id: asset.id,
      url: asset.url,
      mimeType: asset.mimeType,
      size: asset.sizeBytes,
      filename: asset.originalFilename ?? file.name,
      createdAt: asset.createdAt,
    },
  };
}
