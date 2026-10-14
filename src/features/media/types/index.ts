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

/** How a synthesized asset was made (plan 74) — media-service's AssetSynthesisResponseDto. */
export type AssetSynthesis = {
  provider: string;
  /** The narrator's voice. */
  voice: string;
  /** Speaker → voice, when characters have voices of their own. */
  voices?: Record<string, string>;
  lang: string;
  /** `narrationTextHash` of the spoken text; differs from the current body once it is edited. */
  textHash: string;
  segments: number;
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
  /** Plan 74: a person's file or speech synthesis. Absent from an older service. */
  origin?: 'UPLOAD' | 'SYNTHESIZED';
  synthesis?: AssetSynthesis | null;
  /** Set while a lesson body names another asset in this one's place (D5). */
  supersededAt?: string | null;
  supersededBy?: string | null;
  /** The replaced asset can be restored until then; null while it is in use. */
  restorableUntil?: string | null;
};

/** Wire answer of POST /media/narration. */
export type NarrationRequestResponse = {
  assetId: string;
  status: string;
  voice: string;
  textHash: string;
  segments: number;
  characters: number;
};

export type FinalizeUploadResponse = {
  asset: MediaAsset;
};
