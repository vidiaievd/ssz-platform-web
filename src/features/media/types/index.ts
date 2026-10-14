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
  /** Phoneme length multiplier it was spoken with (plan 74, phase 6); absent on older ones. */
  lengthScale?: number;
  /** Multiplier on the pauses between paragraphs and turns. */
  pauseScale?: number;
  /** The course level the pace default came from. */
  level?: string;
  /** The catalog id of the narrator; older narrations name only `voice`. */
  voiceId?: string;
  /** The speaker inside a multi-speaker voice model. */
  speaker?: string;
};

/** How a narration is delivered: the words' speed and the pauses between segments. */
export type NarrationStyle = {
  /** Above 1 speaks slower. */
  lengthScale: number;
  pauseScale: number;
};

/** A narrator an author can choose (media-service's voice catalog). */
export type NarrationVoice = {
  id: string;
  name: string;
  gender: 'female' | 'male';
  /** What a narration gets when no voice is chosen. */
  isDefault: boolean;
};

/** Wire answer of GET /media/narration/defaults. */
export type NarrationDefaults = {
  /** For a course whose level is not a CEFR one. */
  fallback: NarrationStyle;
  byLevel: Record<string, NarrationStyle>;
  /** The voices offered for the language, the default first. */
  voices: NarrationVoice[];
  min: NarrationStyle;
  max: NarrationStyle;
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
  voiceId: string;
  segments: number;
  characters: number;
  lengthScale: number;
  pauseScale: number;
};

export type FinalizeUploadResponse = {
  asset: MediaAsset;
};
