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
};

export type FinalizeUploadResponse = {
  asset: MediaAsset;
};
