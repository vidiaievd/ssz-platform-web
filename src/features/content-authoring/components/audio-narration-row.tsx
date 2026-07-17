'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useMediaAsset, uploadAsset } from '@/features/media';

import { findAudioNarration, removeAudioNarration, setAudioNarration } from '@/lib/content/lesson-media-tokens';
import { EditorCard } from './editor-card';

const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/opus',
  'audio/aac',
  'audio/flac',
  'audio/mp4',
];
const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB, matches media-service's default MAX_AUDIO_SIZE_BYTES

interface AudioNarrationRowProps {
  body: string;
  onChange: (newBody: string) => void;
}

export function AudioNarrationRow({ body, onChange }: AudioNarrationRowProps) {
  const t = useTranslations('Authoring');
  const tMedia = useTranslations('Media');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const narration = findAudioNarration(body);
  const { data: asset } = useMediaAsset(narration?.mediaId);

  async function handleFile(file: File) {
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      toast.error(t('editor.audioNarrationInvalidType'));
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      toast.error(t('editor.audioNarrationTooLarge'));
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadAsset({ file, purpose: 'lesson' });
      onChange(setAudioNarration(body, result.asset.id, narration?.label ?? null));
    } catch {
      toast.error(tMedia('errors.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <EditorCard title={t('editor.audioNarration')}>
      {narration ? (
        <div className="flex flex-col gap-3">
          {asset?.url && <audio controls src={asset.url} className="w-full" />}
          <Field label={t('editor.audioNarrationLabel')} htmlFor="audio-narration-label">
            <Input
              id="audio-narration-label"
              placeholder={t('editor.audioNarrationLabelPlaceholder')}
              value={narration.label ?? ''}
              onChange={(e) =>
                onChange(setAudioNarration(body, narration.mediaId, e.target.value || null))
              }
            />
          </Field>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              loading={isUploading}
            >
              {t('editor.audioNarrationReplace')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(removeAudioNarration(body))}
              className="text-destructive hover:text-destructive"
            >
              {t('editor.audioNarrationRemove')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          loading={isUploading}
        >
          <Upload aria-hidden /> {t('editor.audioNarrationUpload')}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_AUDIO_TYPES.join(',')}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </EditorCard>
  );
}
