'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useMediaAsset, uploadAsset } from '@/features/media';

import { findVideoSource, removeVideoSource, setVideoSource } from '../lib/lesson-media-tokens';
import { EditorCard } from './editor-card';

const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB, matches media-service's default MAX_VIDEO_SIZE_BYTES

interface VideoSourceSlotProps {
  body: string;
  onChange: (newBody: string) => void;
}

export function VideoSourceSlot({ body, onChange }: VideoSourceSlotProps) {
  const t = useTranslations('Authoring');
  const tMedia = useTranslations('Media');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const source = findVideoSource(body);
  const { data: asset } = useMediaAsset(source?.mediaId);

  async function handleFile(file: File) {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      toast.error(t('editor.videoSourceInvalidType'));
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      toast.error(t('editor.videoSourceTooLarge'));
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadAsset({ file, purpose: 'lesson' });
      onChange(setVideoSource(body, result.asset.id));
    } catch {
      toast.error(tMedia('errors.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <EditorCard title={t('editor.videoSource')}>
      {source ? (
        <div className="flex flex-col gap-3">
          {asset?.url && (
            <video controls src={asset.url} className="w-full rounded-lg border border-border" />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              loading={isUploading}
            >
              {t('editor.videoSourceReplace')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(removeVideoSource(body))}
              className="text-destructive hover:text-destructive"
            >
              {t('editor.videoSourceRemove')}
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
          <Upload aria-hidden /> {t('editor.videoSourceUpload')}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES.join(',')}
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
