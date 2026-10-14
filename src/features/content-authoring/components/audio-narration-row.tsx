'use client';

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AudioLines, Loader2, RotateCcw, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import {
  mediaKeys,
  NarrationRequestError,
  requestNarration,
  supersedeAsset,
  uploadAsset,
  useMediaAsset,
  usePreviousAsset,
} from '@/features/media';
import type { AssetResponse } from '@/features/media';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';
import { toNarrationScript } from '@/lib/shared-kernel/narration';

import {
  findAudioNarration,
  removeAudioNarration,
  setAudioNarration,
} from '@/lib/content/lesson-media-tokens';
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

/** Statuses after which an asset no longer changes on its own. */
const SETTLED = new Set(['READY', 'FAILED', 'DELETED']);

interface AudioNarrationRowProps {
  body: string;
  onChange: (newBody: string) => void;
  /**
   * The course's target language — what the synthesizer speaks (plan 74). Without it the
   * row offers uploads only.
   */
  lang?: string;
  /** Stored on a synthesized narration as its entity id. */
  lessonId?: string;
}

/**
 * The lesson's narration: an uploaded recording, or speech synthesis (plan 74).
 *
 * Replacing a narration never deletes the old one (D5): the token moves to the new asset and
 * the old one is marked superseded, stays playable, and can be restored until its retention
 * ends. A synthesized narration is stale when the text it spoke differs from the body — the
 * hash comes from the same kernel script media-service spoke, so a changed picture or label
 * does not count, an edited word does.
 */
export function AudioNarrationRow({ body, onChange, lang, lessonId }: AudioNarrationRowProps) {
  const t = useTranslations('Authoring');
  const tMedia = useTranslations('Media');
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'synthesis' | null>(null);

  const narration = findAudioNarration(body);
  const { data: asset } = useMediaAsset(narration?.mediaId, { pollWhilePending: true });
  const { data: previous } = usePreviousAsset(narration?.mediaId);

  const status = asset?.status ?? 'READY';
  const pending = asset !== undefined && !SETTLED.has(status);
  const failed = status === 'FAILED';
  const synthesized = asset?.origin === 'SYNTHESIZED';
  const stale = useStaleSynthesis(asset, body);
  const restorable = previous != null && isRestorable(previous);

  /** Point the token at `nextId` and mark the asset it named as replaced. */
  function replaceWith(nextId: string) {
    const current = narration?.mediaId;
    onChange(setAudioNarration(body, nextId, narration?.label ?? null));
    if (!current || current === nextId) return;
    // A refused mark changes nothing for the author: the old asset simply is not swept.
    void supersedeAsset(current, nextId)
      .catch(() => undefined)
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: mediaKeys.asset(current) });
        void queryClient.invalidateQueries({ queryKey: mediaKeys.previous(nextId) });
      });
  }

  async function handleFile(file: File) {
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      toast.error(t('editor.audioNarrationInvalidType'));
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      toast.error(t('editor.audioNarrationTooLarge'));
      return;
    }

    setBusy('upload');
    try {
      const result = await uploadAsset({ file, purpose: 'lesson' });
      replaceWith(result.asset.id);
    } catch {
      toast.error(tMedia('errors.uploadFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function synthesize() {
    if (!lang) return;
    setBusy('synthesis');
    try {
      const result = await requestNarration({
        bodyMarkdown: body,
        lang,
        label: narration?.label ?? null,
        lessonId: lessonId ?? null,
      });
      replaceWith(result.assetId);
    } catch (e) {
      const reason = e instanceof NarrationRequestError ? e.reason : null;
      toast.error(
        reason === 'EMPTY_TEXT'
          ? t('editor.audioNarrationSynthEmpty')
          : reason === 'TEXT_TOO_LONG'
            ? t('editor.audioNarrationSynthTooLong')
            : reason === 'LANGUAGE_NOT_SUPPORTED'
              ? t('editor.audioNarrationSynthLanguage')
              : t('editor.audioNarrationSynthFailed'),
      );
    } finally {
      setBusy(null);
    }
  }

  function restorePrevious() {
    if (!previous || !narration) return;
    replaceWith(previous.id);
  }

  const synthButton = (label: string) =>
    lang ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void synthesize()}
        disabled={busy !== null || pending}
        loading={busy === 'synthesis'}
      >
        <AudioLines aria-hidden /> {label}
      </Button>
    ) : null;

  return (
    <EditorCard title={t('editor.audioNarration')}>
      {narration ? (
        <div className="flex flex-col gap-3">
          {pending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {synthesized
                ? t('editor.audioNarrationSynthPending')
                : t('editor.audioNarrationProcessing')}
            </p>
          ) : failed ? (
            <p className="text-sm text-error-700" role="alert">
              {synthesized
                ? t('editor.audioNarrationSynthFailedAsset')
                : t('editor.audioNarrationFailedAsset')}
            </p>
          ) : (
            asset?.url && <audio controls src={asset.url} className="w-full" />
          )}

          {asset && !pending && !failed && (
            <div className="flex flex-wrap items-center gap-2">
              {synthesized ? (
                <Badge variant="info">
                  {t('editor.audioNarrationSynthBadge', { voice: asset.synthesis?.voice ?? '' })}
                </Badge>
              ) : (
                <Badge variant="muted">{t('editor.audioNarrationRecordingBadge')}</Badge>
              )}
              {stale && (
                <Badge variant="warning" role="status">
                  {t('editor.audioNarrationStale')}
                </Badge>
              )}
            </div>
          )}

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

          <div className="flex flex-wrap gap-2">
            {(synthesized || failed) && synthButton(t('editor.audioNarrationResynthesize'))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
              loading={busy === 'upload'}
            >
              {synthesized
                ? t('editor.audioNarrationReplaceWithRecording')
                : t('editor.audioNarrationReplace')}
            </Button>
            {restorable && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={restorePrevious}
                disabled={busy !== null}
                title={t('editor.audioNarrationRestoreUntil', {
                  date: formatDate(new Date(previous.restorableUntil!), locale),
                })}
              >
                <RotateCcw aria-hidden /> {t('editor.audioNarrationRestore')}
              </Button>
            )}
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
            loading={busy === 'upload'}
          >
            <Upload aria-hidden /> {t('editor.audioNarrationUpload')}
          </Button>
          {lang && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void synthesize()}
              disabled={busy !== null}
              loading={busy === 'synthesis'}
            >
              <AudioLines aria-hidden /> {t('editor.audioNarrationSynthesize')}
            </Button>
          )}
        </div>
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

/**
 * Whether a READY synthesized narration spoke a different text than the body holds now.
 * Hashed in the language it was spoken in, by the kernel script media-service used.
 */
function useStaleSynthesis(asset: AssetResponse | undefined, body: string): boolean {
  const synthesis =
    asset?.origin === 'SYNTHESIZED' && asset.status === 'READY' ? asset.synthesis : null;
  const current = useMemo(
    () => (synthesis ? toNarrationScript(body, synthesis.lang).textHash : null),
    [body, synthesis],
  );
  return synthesis != null && current !== synthesis.textHash;
}

/** Still inside its retention period — the sweep may not have run yet, so the date decides. */
function isRestorable(previous: AssetResponse): boolean {
  if (previous.status !== 'READY' || !previous.restorableUntil) return false;
  return Date.parse(previous.restorableUntil) > Date.now();
}
