'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES, uploadAsset } from '@/features/media';

/**
 * Upload a picture and hand back its media id, for the text to place where the caret is —
 * an image inside the text, unlike the cover above it (`HeroImageSlot`). The file's name,
 * without its extension, is the first caption; the author types over it.
 */
export function InsertImageButton({
  onUploaded,
}: {
  onUploaded: (mediaId: string, alt: string) => void;
}) {
  const t = useTranslations('Authoring');
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(t('editor.insertImageFailed'));
      return;
    }
    setBusy(true);
    try {
      const result = await uploadAsset({ file, purpose: 'lesson' });
      onUploaded(result.asset.id, file.name.replace(/\.[^.]+$/, ''));
    } catch {
      toast.error(t('editor.insertImageFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}{' '}
        {t('editor.insertImage')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </>
  );
}
