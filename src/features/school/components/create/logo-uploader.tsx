'use client';

import { useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; preview: string }
  | { status: 'error'; preview: string; message: string }
  | { status: 'done'; preview: string };

type LogoUploaderProps = {
  schoolName: string;
  /** The current CDN URL stored in the form (empty string = no logo). */
  value: string;
  onChange: (url: string) => void;
};

export function LogoUploader({ schoolName, value, onChange }: LogoUploaderProps) {
  const t = useTranslations('School');
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const [uploadState, setUploadState] = useState<UploadState>(
    value ? { status: 'done', preview: value } : { status: 'idle' },
  );

  const preview =
    uploadState.status === 'uploading' || uploadState.status === 'done' || uploadState.status === 'error'
      ? uploadState.preview
      : value || undefined;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after removal
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadState({
        status: 'error',
        preview: preview ?? '',
        message: t('create.basics.logo.error.type'),
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadState({
        status: 'error',
        preview: preview ?? '',
        message: t('create.basics.logo.error.size'),
      });
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setUploadState({ status: 'uploading', preview: localPreview });

    try {
      // Step 1 — request presigned upload URL
      const requestRes = await fetch('/api/media/uploads/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          purpose: 'school_logo',
        }),
      });
      if (!requestRes.ok) throw new Error('upload_request_failed');
      const { uploadUrl, assetId } = (await requestRes.json()) as {
        uploadUrl: string;
        assetId: string;
      };

      // Step 2 — PUT file directly to storage
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('upload_put_failed');

      // Step 3 — finalize
      const finalizeRes = await fetch(`/api/media/uploads/${assetId}/finalize`, {
        method: 'POST',
      });
      if (!finalizeRes.ok) throw new Error('upload_finalize_failed');
      const { url } = (await finalizeRes.json()) as { url: string };

      setUploadState({ status: 'done', preview: url });
      onChange(url);
    } catch {
      setUploadState({
        status: 'error',
        preview: localPreview,
        message: t('create.basics.logo.error.upload'),
      });
    }
  }

  function handleRemove() {
    setUploadState({ status: 'idle' });
    onChange('');
  }

  const isUploading = uploadState.status === 'uploading';
  const hasLogo = Boolean(preview);

  return (
    <div className="flex items-center gap-4">
      {/* Avatar preview */}
      <div className="relative shrink-0">
        <Avatar
          src={preview}
          name={schoolName || 'School'}
          alt={schoolName ? `${schoolName} logo` : 'School logo'}
          size="xl"
          className="rounded-(--ssz-radius-md)"
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-(--ssz-radius-md) bg-black/40">
            <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {hasLogo
              ? t('create.basics.logo.change')
              : t('create.basics.logo.upload')}
          </Button>

          {hasLogo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isUploading}
              onClick={handleRemove}
              className={cn(
                'gap-1.5 text-(--ssz-text-secondary)',
                'hover:text-[var(--ssz-color-error-600)]',
              )}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {t('create.basics.logo.remove')}
            </Button>
          )}
        </div>

        <p className="text-xs text-(--ssz-text-muted)" aria-describedby={errorId}>
          {t('create.basics.logo.help')}
        </p>

        {uploadState.status === 'error' && (
          <p id={errorId} role="alert" className="text-xs text-[var(--ssz-color-error-600)]">
            {uploadState.message}
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />
    </div>
  );
}
