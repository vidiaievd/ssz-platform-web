'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload, Volume2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useMediaAsset, uploadAsset } from '@/features/media';

/** What media-service accepts for audio, and the ceiling it enforces. */
const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/opus',
  'audio/aac',
  'audio/flac',
  'audio/mp4',
];
const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB, matches media-service's default

export interface ItemAudioSlotProps {
  mediaId?: string;
  /**
   * Why this sentence cannot carry audio. Present means the slot is inert — with
   * `to_target` the sentence on screen is in the language of explanation, and voicing it
   * would read the answer's meaning aloud in a language the student already reads.
   */
  disabledReason?: string;
  onChange: (mediaId: string | undefined) => void;
}

/**
 * Audio of the sentence the student reads — plan 42, "Слот медиа".
 *
 * It sits on the sentence rather than on the exercise because the sources are different
 * sentences, and that is the whole point of it: a set whose sources are spoken is a
 * listening-and-translating exercise, which no template on this platform has offered
 * before. There is no replay limit; `flow.replayLimit` is carried in the model for the
 * listening template that will need one, and a limit enforced in the browser is a limit a
 * page reload removes.
 */
export function ItemAudioSlot({ mediaId, disabledReason, onChange }: ItemAudioSlotProps) {
  const t = useTranslations('Authoring');
  const tMedia = useTranslations('Media');
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const inert = disabledReason !== undefined;

  async function handleFile(file: File) {
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      toast.error(t('translate.step2.audioInvalidType'));
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      toast.error(t('translate.step2.audioTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const result = await uploadAsset({ file, purpose: 'lesson' });
      onChange(result.asset.id);
    } catch {
      toast.error(tMedia('errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  // Nothing attached and nothing attachable: one line saying why, rather than a dead
  // button. The author is choosing a direction, not fighting a control.
  if (inert && mediaId === undefined) {
    return <p className="mt-2 text-xs text-muted-foreground">{disabledReason}</p>;
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {mediaId !== undefined && (
        <>
          <p className="flex items-center gap-1 text-xs font-medium">
            <Volume2 className="size-3.5" aria-hidden />
            {t('translate.step2.audioLabel')}
          </p>
          <AttachedAudio mediaId={mediaId} />
          {/* An attachment made before the direction changed still plays, and can still be
              taken off — hiding the remove button would strand it in the document. */}
          {inert && <p className="text-xs text-warning-700">{disabledReason}</p>}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading || inert}
          loading={uploading}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-3.5" aria-hidden />
          {mediaId === undefined
            ? t('translate.step2.audioAttach')
            : t('translate.step2.audioReplace')}
        </Button>
        {mediaId !== undefined && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onChange(undefined)}
          >
            <X className="size-3.5" aria-hidden />
            {t('translate.step2.audioRemove')}
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_AUDIO_TYPES.join(',')}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

/**
 * The attachment, playable. Its own component so that the media lookup happens only for a
 * sentence that has something attached — a set with no audio asks media-service nothing.
 */
function AttachedAudio({ mediaId }: { mediaId: string }) {
  const { data: asset } = useMediaAsset(mediaId);

  if (asset?.url === undefined || asset.url === null) return null;

  return <audio controls preload="none" src={asset.url} className="w-full" />;
}
