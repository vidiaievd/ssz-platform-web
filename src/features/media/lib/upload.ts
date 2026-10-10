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
  /** What owns the asset — the exercise a clip belongs to (plan 72 §3.4). */
  entityId?: string;
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
  entityId,
  onProgress,
}: UploadAvatarOptions): Promise<FinalizeUploadResponse> {
  // Step 1 — request presigned URL
  const body: RequestUploadBody = {
    mimeType: file.type,
    sizeBytes: file.size,
    originalFilename: file.name,
    entityType: PURPOSE_TO_ENTITY_TYPE[purpose],
    ...(entityId === undefined ? {} : { entityId }),
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

/** The kind media-service keeps a student's spoken answer under (plan 70, Q2-A). */
export const RECORDING_ENTITY_TYPE = 'submission_recording';

/**
 * Why a recording did not make it into storage. `code` is media-service's own when it refused
 * the file (`RECORDING_TOO_LONG`, `RECORDING_TOO_LARGE`, `RECORDING_UNREADABLE`,
 * `MIME_TYPE_NOT_ALLOWED`) and `null` when the request simply failed.
 */
export class RecordingUploadError extends Error {
  constructor(
    readonly code: string | null,
    readonly status: number | null,
  ) {
    super(code ?? `Recording upload failed${status === null ? '' : ` (${status})`}`);
    this.name = 'RecordingUploadError';
  }
}

type UploadRecordingOptions = {
  blob: Blob;
  /** As the recorder produced it; the codec parameter is dropped for storage. */
  mimeType: string;
  /** The attempt the recording answers — the asset's `entityId` (RA-U2). */
  attemptId: string;
  /** A file name for the asset row, e.g. `p1-take-2.webm`. */
  filename: string;
  onProgress?: UploadProgressCallback;
};

/**
 * One take of a `read_aloud` prompt, into media-service (plan 70 §3.4).
 *
 * The same three steps as `uploadAsset` — slot, PUT to MinIO, finalize — with the attempt as
 * the owner of the asset, and without the fourth: the runner already holds the take (a `blob:`
 * URL), so there is nothing to fetch back. Finalize is where the service measures the stored
 * object and refuses one over the ceilings, and its code is kept, because «too long» and «the
 * network dropped» want different words on the screen.
 */
export async function uploadRecording({
  blob,
  mimeType,
  attemptId,
  filename,
  onProgress,
}: UploadRecordingOptions): Promise<{ assetId: string }> {
  // The signed PUT does not bind a content type; the bare one is what the object is served as.
  const type = (mimeType.split(';')[0] ?? '').trim().toLowerCase() || 'audio/webm';
  const file = new File([blob], filename, { type });

  const body: RequestUploadBody = {
    mimeType: type,
    sizeBytes: file.size,
    originalFilename: filename,
    entityType: RECORDING_ENTITY_TYPE,
    entityId: attemptId,
  };

  let requestRes: Response;
  try {
    requestRes = await fetch('/api/media/uploads/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RecordingUploadError(null, null);
  }
  if (!requestRes.ok) throw new RecordingUploadError(await codeOf(requestRes), requestRes.status);

  const { assetId, uploadUrl } = (await requestRes.json()) as RequestUploadResponse;

  try {
    await uploadToPresignedUrl(uploadUrl, file, onProgress);
  } catch {
    throw new RecordingUploadError(null, null);
  }

  let finalizeRes: Response;
  try {
    finalizeRes = await fetch(`/api/media/uploads/${assetId}/finalize`, { method: 'POST' });
  } catch {
    throw new RecordingUploadError(null, null);
  }
  if (!finalizeRes.ok)
    throw new RecordingUploadError(await codeOf(finalizeRes), finalizeRes.status);

  return { assetId };
}

async function codeOf(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
  return typeof body?.code === 'string' ? body.code : null;
}
