'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImageIcon, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  uploadAsset,
  useMediaAsset,
} from '@/features/media';
import type { Image as TaskImage } from '@/lib/shared-kernel/writing-task';

export interface ImageSlotProps {
  image: TaskImage;
  onChange: (next: TaskImage) => void;
}

/**
 * The picture a `mode: 'picture'` task is written about, with its caption and its alt
 * text.
 *
 * The document holds an `assetId`, not an address — the same decision the runner body
 * made in phase 4. An id survives a signed URL expiring and a storage host moving; a URL
 * pasted into content does neither, and the day it stops resolving the task stops being
 * answerable.
 *
 * Upload only. "Choose one you have already used" needs a media library with search,
 * licence and reuse rules, and the handoff names that an open question rather than a
 * feature (plan 50 §3.6) — so it is not stubbed here.
 *
 * Alt text is a field of its own and not derived from the caption, because they do
 * different jobs: the caption is part of the task the student reads, and the alt text is
 * what stands in for the picture for a student who cannot see it — which, for a task
 * that *is* the picture, is the difference between a hard exercise and an impossible one.
 */
export function ImageSlot({ image, onChange }: ImageSlotProps) {
  const t = useTranslations('Authoring');
  const tMedia = useTranslations('Media');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: asset, isLoading } = useMediaAsset(image.assetId);

  async function handleFile(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(tMedia('errors.invalidType'));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(tMedia('errors.tooLarge'));
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadAsset({ file, purpose: 'exercise' });
      onChange({ ...image, assetId: result.asset.id });
    } catch {
      toast.error(tMedia('errors.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-(--ssz-bg-base)">
          {image.assetId === undefined ? (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          ) : isLoading || !asset ? (
            <Skeleton className="h-full w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- an author-uploaded asset on media-service, not a local image the optimiser can reach
            <img src={asset.url} alt={image.alt} className="h-full w-full object-cover" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              {image.assetId === undefined ? tMedia('upload') : tMedia('change')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('writingTask.step1.imageHelp')}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('writingTask.step1.captionLabel')}
          <Input
            value={image.caption}
            placeholder={t('writingTask.step1.captionPlaceholder')}
            onChange={(event) => onChange({ ...image, caption: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('writingTask.step1.altLabel')}
          <Input
            value={image.alt}
            placeholder={t('writingTask.step1.altPlaceholder')}
            onChange={(event) => onChange({ ...image, alt: event.target.value })}
          />
        </label>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
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
