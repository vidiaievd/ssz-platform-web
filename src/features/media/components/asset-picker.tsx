'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { uploadAsset } from '../lib/upload';
import type { MediaPurpose } from '../types';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

type AssetPickerProps = {
  currentUrl?: string | null;
  name?: string;
  purpose?: MediaPurpose;
  onUploaded: (assetUrl: string) => Promise<void> | void;
};

type PickerState =
  | { kind: 'idle' }
  | { kind: 'preview'; file: File; objectUrl: string }
  | { kind: 'uploading'; file: File; objectUrl: string; progress: number }
  | { kind: 'done'; objectUrl: string };

export function AssetPicker({ currentUrl, name, purpose = 'avatar', onUploaded }: AssetPickerProps) {
  const t = useTranslations('Media');
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PickerState>({ kind: 'idle' });

  const previewUrl =
    state.kind === 'idle' ? (currentUrl ?? undefined)
    : state.kind === 'done' ? state.objectUrl
    : state.objectUrl;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('errors.invalidType'));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(t('errors.tooLarge'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setState({ kind: 'preview', file, objectUrl });
  }

  function handleDiscard() {
    if (state.kind === 'preview' || state.kind === 'done') {
      URL.revokeObjectURL(state.objectUrl);
    }
    setState({ kind: 'idle' });
  }

  const handleUpload = useCallback(async () => {
    if (state.kind !== 'preview') return;
    const { file, objectUrl } = state;

    setState({ kind: 'uploading', file, objectUrl, progress: 0 });

    try {
      const result = await uploadAsset({
        file,
        purpose,
        onProgress: (pct) =>
          setState((prev) => (prev.kind === 'uploading' ? { ...prev, progress: pct } : prev)),
      });

      const url = result.asset.url;
      setState({ kind: 'done', objectUrl });
      await onUploaded(url);
      toast.success(t('uploadSuccess'));
    } catch {
      setState({ kind: 'preview', file, objectUrl });
      toast.error(t('errors.uploadFailed'));
    }
  }, [state, purpose, onUploaded, t]);

  const isUploading = state.kind === 'uploading';

  return (
    <div className="flex items-start gap-4">
      <div className="relative shrink-0">
        <Avatar src={previewUrl} name={name} size="xl" />
        {(state.kind === 'preview' || state.kind === 'done') && (
          <button
            type="button"
            aria-label={t('discard')}
            onClick={handleDiscard}
            className="absolute -top-1 -right-1 rounded-full bg-[var(--ssz-surface)] border border-[var(--ssz-border)] p-0.5 shadow-sm hover:bg-[var(--ssz-surface-hover)] transition-colors"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="space-y-2 flex-1 min-w-0">
        {state.kind === 'uploading' ? (
          <ProgressBar value={state.progress} showLabel className="mt-5" />
        ) : state.kind === 'preview' ? (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handleUpload} disabled={isUploading}>
              <Upload className="size-3.5 mr-1.5" />
              {t('save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDiscard}>
              {t('discard')}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="size-3.5 mr-1.5" />
            {t('change')}
          </Button>
        )}

        <p className="text-xs text-[var(--ssz-text-muted)]">
          {t('hint')}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleFileChange}
      />
    </div>
  );
}
