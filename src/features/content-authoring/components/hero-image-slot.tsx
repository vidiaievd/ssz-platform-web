'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaAsset, uploadAsset, ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from '@/features/media';

import { findHeroImage, removeHeroImage, setHeroImage } from '../lib/lesson-media-tokens';
import { EditorCard } from './editor-card';

interface HeroImageSlotProps {
  body: string;
  /** Used as the alt text default when an image is uploaded for the first time. */
  altDefault: string;
  onChange: (newBody: string) => void;
}

export function HeroImageSlot({ body, altDefault, onChange }: HeroImageSlotProps) {
  const t = useTranslations('Authoring');
  const tMedia = useTranslations('Media');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const hero = findHeroImage(body);
  const { data: asset, isLoading: assetLoading } = useMediaAsset(hero?.mediaId);

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
      const result = await uploadAsset({ file, purpose: 'lesson' });
      onChange(setHeroImage(body, result.asset.id, hero?.alt || altDefault));
    } catch {
      toast.error(tMedia('errors.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <EditorCard title={t('editor.heroImage')}>
      {hero ? (
        <div className="flex flex-col gap-3">
          <div className="h-27.5 w-full overflow-hidden rounded-lg border border-border bg-(--ssz-bg-base)">
            {assetLoading || !asset ? (
              <Skeleton className="h-full w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- author-uploaded asset, not a static/optimizable local image
              <img src={asset.url} alt={hero.alt} className="h-full w-full object-cover" />
            )}
          </div>
          <Field label={t('editor.heroImageAlt')} htmlFor="hero-image-alt">
            <Input
              id="hero-image-alt"
              placeholder={t('editor.heroImageAltPlaceholder')}
              value={hero.alt}
              onChange={(e) => onChange(setHeroImage(body, hero.mediaId, e.target.value))}
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
              {t('editor.heroImageReplace')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(removeHeroImage(body))}
              className="text-destructive hover:text-destructive"
            >
              {t('editor.heroImageRemove')}
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
          <Upload aria-hidden /> {t('editor.heroImageUpload')}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
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
