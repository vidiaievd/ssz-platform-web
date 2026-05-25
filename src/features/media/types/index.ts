export type MediaPurpose = 'avatar' | 'lesson' | 'exercise';

export type RequestUploadBody = {
  filename: string;
  mimeType: string;
  size: number;
  purpose?: MediaPurpose;
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

export type FinalizeUploadResponse = {
  asset: MediaAsset;
};
