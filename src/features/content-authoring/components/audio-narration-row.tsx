'use client';

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AudioLines, Loader2, RotateCcw, SlidersHorizontal, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import {
  mediaKeys,
  NarrationRequestError,
  requestNarration,
  supersedeAsset,
  useNarrationDefaults,
  uploadAsset,
  useMediaAsset,
  usePreviousAsset,
} from '@/features/media';
import type {
  AssetResponse,
  NarrationDefaults,
  NarrationStyle,
  NarrationVoice,
} from '@/features/media';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';
import { narrationSpeakers, toNarrationScript } from '@/lib/shared-kernel/narration';

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
  /** The course's CEFR level: the default pace of the narration is chosen for it. */
  level?: string;
}

const SLIDER_EPSILON = 0.001;

/** The level's default style, or the service's fallback for a course on another level system. */
function defaultStyleFor(
  defaults: NarrationDefaults | undefined,
  level?: string,
): NarrationStyle | undefined {
  if (!defaults) return undefined;
  return (level ? defaults.byLevel[level] : undefined) ?? defaults.fallback;
}

const sameStyle = (a: NarrationStyle, b: NarrationStyle) =>
  Math.abs(a.lengthScale - b.lengthScale) < SLIDER_EPSILON &&
  Math.abs(a.pauseScale - b.pauseScale) < SLIDER_EPSILON;

/**
 * The lesson's narration: an uploaded recording, or speech synthesis (plan 74).
 *
 * Replacing a narration never deletes the old one (D5): the token moves to the new asset and
 * the old one is marked superseded, stays playable, and can be restored until its retention
 * ends. A synthesized narration is stale when the text it spoke differs from the body — the
 * hash comes from the same kernel script media-service spoke, so a changed picture or label
 * does not count, an edited word does.
 */
/** The «let media-service choose» option of a speaker's voice. */
const AUTO_VOICE = 'auto';

export function AudioNarrationRow({
  body,
  onChange,
  lang,
  lessonId,
  level,
}: AudioNarrationRowProps) {
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

  // Pace and pauses of the next synthesis. Untouched, they follow what the current narration was
  // spoken with (so "narrate again" repeats it), and failing that the course level's default;
  // a slider or the reset button makes them explicit.
  const { data: defaults } = useNarrationDefaults(lang);
  const levelDefault = defaultStyleFor(defaults, level);
  const [chosenStyle, setChosenStyle] = useState<NarrationStyle | null>(null);
  const spokenWith =
    synthesized &&
    asset?.synthesis?.lengthScale !== undefined &&
    asset.synthesis.pauseScale !== undefined
      ? { lengthScale: asset.synthesis.lengthScale, pauseScale: asset.synthesis.pauseScale }
      : null;
  const style = chosenStyle ?? spokenWith ?? levelDefault;
  const styleIsDefault =
    style !== undefined && levelDefault !== undefined && sameStyle(style, levelDefault);

  // The narrator of the next synthesis: the author's pick, else the one the current narration was
  // spoken by, else the service's default voice.
  const defaultVoice = defaults?.voices.find((v) => v.isDefault) ?? defaults?.voices[0];
  const [chosenVoice, setChosenVoice] = useState<string | null>(null);
  const spokenVoice =
    synthesized &&
    asset?.synthesis?.voiceId &&
    defaults?.voices.some((v) => v.id === asset.synthesis?.voiceId)
      ? asset.synthesis.voiceId
      : undefined;
  const voiceId = chosenVoice ?? spokenVoice ?? defaultVoice?.id;
  const voiceIsDefault = voiceId === undefined || voiceId === defaultVoice?.id;
  const voiceLabel = (voice: NarrationVoice) =>
    `${voice.gender === 'female' ? t('editor.audioNarrationVoiceFemale') : t('editor.audioNarrationVoiceMale')} · ${voice.name}`;
  // What the badge names: the catalog's name for the narrator, or the model's for an older narration.
  const spokenVoice0 = defaults?.voices.find((v) => v.id === asset?.synthesis?.voiceId);

  // Who speaks in the dialogue, and with which voice (plan 74, phase 8). Untouched, a speaker
  // keeps the voice the current narration gave them, so "narrate again" repeats it; «Auto» leaves
  // the choice to media-service, which gives each speaker a voice of their own.
  const speakers = useMemo(
    () => (lang ? narrationSpeakers(toNarrationScript(body, lang).segments) : []),
    [body, lang],
  );
  const [chosenSpeakerVoices, setChosenSpeakerVoices] = useState<Record<string, string>>({});
  const spokenSpeakerVoices = synthesized ? (asset?.synthesis?.voices ?? {}) : {};
  const speakerVoiceOf = (speaker: string): string =>
    chosenSpeakerVoices[speaker] ?? spokenSpeakerVoices[speaker] ?? AUTO_VOICE;
  const speakerVoices = Object.fromEntries(
    speakers
      .map((speaker) => [speaker, speakerVoiceOf(speaker)] as const)
      .filter(([, voice]) => voice !== AUTO_VOICE && defaults?.voices.some((v) => v.id === voice)),
  );
  const spokenVoiceName = spokenVoice0 ? voiceLabel(spokenVoice0) : (asset?.synthesis?.voice ?? '');

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
        level: level ?? null,
        ...(style ? { lengthScale: style.lengthScale, pauseScale: style.pauseScale } : {}),
        ...(voiceId ? { voiceId } : {}),
        speakerVoices,
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
              : reason === 'VOICE_NOT_AVAILABLE'
                ? t('editor.audioNarrationSynthVoice')
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

  const settings =
    lang && defaults && style ? (
      <details className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <SlidersHorizontal className="size-4" aria-hidden /> {t('editor.audioNarrationSettings')}
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {defaults.voices.length > 1 && voiceId && (
            <Field label={t('editor.audioNarrationVoice')} htmlFor="narration-voice">
              <select
                id="narration-voice"
                value={voiceId}
                onChange={(e) => setChosenVoice(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {defaults.voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voiceLabel(voice)}
                    {voice.isDefault ? ` (${t('editor.audioNarrationVoiceDefaultMark')})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {defaults.voices.length > 1 && speakers.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                {t('editor.audioNarrationSpeakers')}
              </legend>
              {speakers.map((speaker) => (
                <label key={speaker} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate font-medium">{speaker}</span>
                  <select
                    aria-label={t('editor.audioNarrationSpeakerVoice', { speaker })}
                    value={speakerVoiceOf(speaker)}
                    onChange={(e) =>
                      setChosenSpeakerVoices((current) => ({
                        ...current,
                        [speaker]: e.target.value,
                      }))
                    }
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value={AUTO_VOICE}>{t('editor.audioNarrationSpeakerAuto')}</option>
                    {defaults.voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voiceLabel(voice)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                {t('editor.audioNarrationSpeakersHint')}
              </p>
            </fieldset>
          )}
          <Field
            label={t('editor.audioNarrationPace', { value: style.lengthScale.toFixed(2) })}
            htmlFor="narration-pace"
          >
            <input
              id="narration-pace"
              type="range"
              className="w-full accent-primary"
              min={defaults.min.lengthScale}
              max={defaults.max.lengthScale}
              step={0.05}
              value={style.lengthScale}
              onChange={(e) => setChosenStyle({ ...style, lengthScale: Number(e.target.value) })}
            />
            <span className="flex justify-between text-xs text-muted-foreground">
              <span>{t('editor.audioNarrationPaceFaster')}</span>
              <span>{t('editor.audioNarrationPaceSlower')}</span>
            </span>
          </Field>
          <Field
            label={t('editor.audioNarrationPauses', { value: style.pauseScale.toFixed(1) })}
            htmlFor="narration-pauses"
          >
            <input
              id="narration-pauses"
              type="range"
              className="w-full accent-primary"
              min={defaults.min.pauseScale}
              max={defaults.max.pauseScale}
              step={0.1}
              value={style.pauseScale}
              onChange={(e) => setChosenStyle({ ...style, pauseScale: Number(e.target.value) })}
            />
            <span className="flex justify-between text-xs text-muted-foreground">
              <span>{t('editor.audioNarrationPausesShorter')}</span>
              <span>{t('editor.audioNarrationPausesLonger')}</span>
            </span>
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {level && defaults.byLevel[level]
                ? t('editor.audioNarrationSettingsDefaultForLevel', {
                    level,
                    pace: defaults.byLevel[level].lengthScale.toFixed(2),
                  })
                : t('editor.audioNarrationSettingsDefault', {
                    pace: defaults.fallback.lengthScale.toFixed(2),
                  })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setChosenStyle(levelDefault ?? null);
                setChosenVoice(defaultVoice?.id ?? null);
              }}
              disabled={styleIsDefault && voiceIsDefault}
            >
              <RotateCcw aria-hidden /> {t('editor.audioNarrationSettingsReset')}
            </Button>
          </div>
        </div>
      </details>
    ) : null;

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
                  {t('editor.audioNarrationSynthBadge', { voice: spokenVoiceName })}
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

          {(synthesized || failed) && !pending && settings}

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
        <div className="flex flex-col gap-3">
          {settings}
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
