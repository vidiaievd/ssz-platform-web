export type MediaPurpose = 'avatar' | 'lesson' | 'exercise';

// Wire body for POST /media/uploads/request — field names must match the
// media-service's RequestUploadDto exactly (whitelist validation rejects
// unknown fields and requires sizeBytes).
export type RequestUploadBody = {
  mimeType: string;
  sizeBytes: number;
  originalFilename?: string;
  entityType?: string;
  entityId?: string;
};

export type RequestUploadResponse = {
  assetId: string;
  uploadUrl: string;
};

export type MediaAsset = {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  filename: string;
  createdAt: string;
};

// Shape returned by GET /media/assets/:id (media-service's AssetResponseDto).
export type AssetResponse = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
  createdAt: string;
  /** `PENDING_UPLOAD → UPLOADED → PROCESSING → READY`, or `FAILED` / `DELETED`. */
  status?: string;
  entityType?: string | null;
  /** For a `submission_recording`, the attempt it was made for (plan 70, Q2-A). */
  entityId?: string | null;
  /** Measured on ingest for recordings; null until then and for everything else. */
  durationMs?: number | null;
  /** 0..1 waveform, computed by the audio worker; null until it has run. */
  peaks?: number[] | null;
};

export type FinalizeUploadResponse = {
  asset: MediaAsset;
};
