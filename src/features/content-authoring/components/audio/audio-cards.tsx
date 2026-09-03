'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AudioLines, Link2, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Textarea } from '@/components/ui/textarea';
import { useMediaAsset, uploadAsset } from '@/features/media';
import {
  formatDuration,
  hasClip,
  parseDuration,
  withAudio,
  withAudioSettings,
  type AudioDraft,
  type AudioSource,
  type GateMode,
  type ItemAudio,
  type PlayLimit,
  type TranscriptPolicy,
} from '@/lib/shared-kernel/audio';

import { EditorCard } from '../editor-card';
import { ToggleRow } from '../toggle-row';

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
const MAX_AUDIO_SIZE_BYTES = 100 * 1024 * 1024;

export interface AudioCardProps {
  draft: AudioDraft;
  onChange: (next: AudioDraft) => void;
}

/**
 * The switch that turns an exercise into a listening exercise — plan 56, BEHAVIOR §1.
 *
 * It sits inside the card the type already has for its title and instruction, because
 * audio is material and material is where material lives. While it is off the builder is
 * what it was: no empty audio section, no placeholder.
 *
 * Switching off never destroys anything. The clip, the transcript and the timecodes stay
 * in the draft and come back with the switch — an author trying the exercise both ways
 * must not be punished for it.
 */
export function AudioEnableRow({ draft, onChange }: AudioCardProps) {
  const t = useTranslations('Authoring');

  return (
    <ToggleRow
      label={t('audio.enableLabel')}
      help={t('audio.enableHelp')}
      checked={draft.audio.enabled}
      onChange={(enabled) => onChange(withAudio(draft, { enabled }))}
    />
  );
}

/**
 * Where the clip comes from — README "AXSourceCard".
 *
 * Three sources, and only the active one decides what the student is played: switching
 * from a file to a link keeps the file, because an author comparing two takes should not
 * have to upload the first one twice.
 *
 * `lesson` is declared in the model and not offered here. Plan 56 §3.8 puts it in phase 6
 * — it is the one source that has to read another aggregate — and a third tab that could
 * not do anything yet would be worse than the two that work.
 */
export function AudioSourceCard({ draft, onChange }: AudioCardProps) {
  const t = useTranslations('Authoring');
  const tMedia = useTranslations('Media');
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [duration, setDuration] = useState(formatDuration(draft.audio.duration));

  const { audio } = draft;
  const { data: asset } = useMediaAsset(
    audio.source === 'asset' && audio.assetId !== '' ? audio.assetId : undefined,
  );

  async function handleFile(file: File) {
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      toast.error(t('audio.invalidType'));
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      toast.error(t('audio.tooLarge'));
      return;
    }

    setUploading(true);
    try {
      const result = await uploadAsset({ file, purpose: 'exercise' });
      // The title defaults to the filename without its extension, and the length is read
      // from the file — both editable, both only a starting point.
      const name = file.name.replace(/\.[^.]+$/, '');
      const probed = await readDuration(file);
      setDuration(formatDuration(probed));
      onChange(
        withAudio(draft, {
          assetId: result.asset.id,
          fileName: file.name,
          title: audio.title.trim() === '' ? name : audio.title,
          duration: probed,
        }),
      );
    } catch {
      toast.error(tMedia('errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <EditorCard title={t('audio.sourceTitle')}>
      <div className="flex flex-col gap-4">
        <Segmented<AudioSource>
          aria-label={t('audio.sourceTitle')}
          value={audio.source === 'lesson' ? 'asset' : audio.source}
          onValueChange={(source) => onChange(withAudio(draft, { source }))}
          options={[
            { value: 'asset', label: t('audio.sourceUpload'), icon: Upload },
            { value: 'link', label: t('audio.sourceLink'), icon: Link2 },
          ]}
        />

        {audio.source === 'link' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audio-url">{t('audio.urlLabel')}</Label>
            <Input
              id="audio-url"
              value={audio.url}
              placeholder="https://…"
              onChange={(e) => onChange(withAudio(draft, { url: e.target.value }))}
            />
          </div>
        ) : audio.assetId === '' ? (
          <div
            data-over={dragging}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center ${
              dragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <AudioLines className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t('audio.dropHere')}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={uploading}
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              {t('audio.chooseFile')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <AudioLines className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {audio.fileName === '' ? audio.title : audio.fileName}
              </p>
              {asset?.url !== undefined && asset.url !== null && (
                <audio controls preload="none" src={asset.url} className="mt-2 w-full" />
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              // The clip goes; the title, the transcript and the timecodes stay. Removing
              // a file is replacing it, nine times out of ten (BEHAVIOR §2).
              onClick={() => onChange(withAudio(draft, { assetId: '', fileName: '' }))}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {t('audio.remove')}
            </Button>
          </div>
        )}

        {!hasClip(audio) && (
          <p className="text-xs text-muted-foreground">{t('audio.noClipYet')}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audio-title">{t('audio.titleLabel')}</Label>
            <Input
              id="audio-title"
              value={audio.title}
              placeholder={t('audio.titlePlaceholder')}
              onChange={(e) => onChange(withAudio(draft, { title: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audio-duration">{t('audio.durationLabel')}</Label>
            <Input
              id="audio-duration"
              value={duration}
              placeholder="1:36"
              inputMode="numeric"
              onChange={(e) => {
                setDuration(e.target.value);
                const seconds = parseDuration(e.target.value);
                // Unparseable input keeps the last valid value: the field is passed
                // through on the way to `1:36`, and blanking it there would fight the
                // author mid-keystroke.
                if (seconds !== null) onChange(withAudio(draft, { duration: seconds }));
              }}
            />
          </div>
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
    </EditorCard>
  );
}

/** Read the clip's length from the file itself — the hint the author can correct. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (seconds: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seconds) ? Math.round(seconds) : 0);
    };
    probe.addEventListener('loadedmetadata', () => done(probe.duration));
    probe.addEventListener('error', () => done(0));
    probe.src = url;
  });
}

/**
 * How the clip may be heard — README "AXRulesCard".
 *
 * `itemNoun` is the one string each exercise type overrides: the author is told the
 * questions lock, or the statements, or the gaps.
 */
export function AudioRulesCard({
  draft,
  onChange,
  itemNoun,
}: AudioCardProps & { itemNoun: string }) {
  const t = useTranslations('Authoring');
  const s = draft.audio.settings;

  return (
    <EditorCard title={t('audio.rulesTitle')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t('audio.layoutLabel')}</Label>
          <Segmented<'top' | 'gate'>
            aria-label={t('audio.layoutLabel')}
            value={s.layout}
            onValueChange={(layout) => onChange(withAudioSettings(draft, { layout }))}
            options={[
              { value: 'top', label: t('audio.layoutTop') },
              { value: 'gate', label: t('audio.layoutGate') },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {s.layout === 'top' ? t('audio.layoutTopHelp') : t('audio.layoutGateHelp')}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t('audio.playsLabel')}</Label>
          <Segmented<'0' | '1' | '2' | '3'>
            aria-label={t('audio.playsLabel')}
            value={String(s.plays) as '0' | '1' | '2' | '3'}
            onValueChange={(value) =>
              onChange(withAudioSettings(draft, { plays: Number(value) as PlayLimit }))
            }
            options={[
              { value: '0', label: t('audio.playsUnlimited') },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
          {/* The one thing about the limit an author must be told, because it is not what
              "limit" usually means: it is client-side in v1 (plan 56 §3.6). */}
          {s.plays > 0 && <p className="text-xs text-muted-foreground">{t('audio.playsHelp')}</p>}
        </div>

        <ToggleRow
          label={t('audio.seekLabel')}
          help={t('audio.seekHelp')}
          checked={s.seek}
          onChange={(seek) => onChange(withAudioSettings(draft, { seek }))}
        />
        <ToggleRow
          label={t('audio.speedLabel')}
          help={t('audio.speedHelp')}
          checked={s.speed}
          onChange={(speed) => onChange(withAudioSettings(draft, { speed }))}
        />
        <ToggleRow
          label={t('audio.gateLabel', { items: itemNoun })}
          help={t('audio.gateHelp')}
          checked={s.gate === 'first'}
          onChange={(on) =>
            onChange(withAudioSettings(draft, { gate: (on ? 'first' : 'none') as GateMode }))
          }
        />
        <ToggleRow
          label={t('audio.segmentsLabel')}
          help={t('audio.segmentsHelp')}
          checked={draft.audio.useSegments}
          onChange={(useSegments) => onChange(withAudio(draft, { useSegments }))}
        />
      </div>
    </EditorCard>
  );
}

/**
 * What the clip says, and who may read it — README "AXTranscriptCard".
 *
 * The policy is above the text on purpose: it is the decision, and the text is what the
 * decision is about. `always` is the accommodation path for a student who cannot rely on
 * hearing the clip, and the help line says so — an author choosing between three words
 * needs to know that one of them is an accessibility setting.
 */
export function AudioTranscriptCard({ draft, onChange }: AudioCardProps) {
  const t = useTranslations('Authoring');
  const { audio } = draft;
  const missing = audio.settings.transcriptWhen !== 'never' && audio.transcript.trim() === '';

  return (
    <EditorCard title={t('audio.transcriptTitle')}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t('audio.policyLabel')}</Label>
          <Segmented<TranscriptPolicy>
            aria-label={t('audio.policyLabel')}
            value={audio.settings.transcriptWhen}
            onValueChange={(transcriptWhen) =>
              onChange(withAudioSettings(draft, { transcriptWhen }))
            }
            options={[
              { value: 'never', label: t('audio.policyNever') },
              { value: 'after', label: t('audio.policyAfter') },
              { value: 'always', label: t('audio.policyAlways') },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {audio.settings.transcriptWhen === 'always'
              ? t('audio.policyAlwaysHelp')
              : audio.settings.transcriptWhen === 'after'
                ? t('audio.policyAfterHelp')
                : t('audio.policyNeverHelp')}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audio-transcript">{t('audio.transcriptLabel')}</Label>
          <Textarea
            id="audio-transcript"
            rows={5}
            data-bad={missing || undefined}
            className="font-(--ssz-font-reading) data-[bad=true]:border-destructive"
            value={audio.transcript}
            placeholder={t('audio.transcriptPlaceholder')}
            onChange={(e) => onChange(withAudio(draft, { transcript: e.target.value }))}
          />
          {missing && <p className="text-xs text-destructive">{t('audio.transcriptMissing')}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audio-translation">{t('audio.translationLabel')}</Label>
          <Textarea
            id="audio-translation"
            rows={3}
            value={audio.translation}
            onChange={(e) => onChange(withAudio(draft, { translation: e.target.value }))}
          />
        </div>
      </div>
    </EditorCard>
  );
}

/**
 * One item's slice of the clip — README "AXSegmentField".
 *
 * Two text fields rather than a waveform selection, and that is the whole v1: a teacher
 * writing "0:22" and "0:48" is doing what a drag on a waveform would do, without a
 * backend pre-render (plan 56, out of scope).
 *
 * An empty pair is no timecode at all, which is what the fragment chip reads as "play the
 * whole clip" — so clearing one field clears the timecode rather than leaving half of it.
 */
export function AudioSegmentField({
  segment,
  onChange,
}: {
  segment: ItemAudio | null;
  onChange: (next: ItemAudio | null) => void;
}) {
  const t = useTranslations('Authoring');
  const [from, setFrom] = useState(segment === null ? '' : formatDuration(segment.start));
  const [to, setTo] = useState(segment === null ? '' : formatDuration(segment.end));

  function push(nextFrom: string, nextTo: string) {
    const start = parseDuration(nextFrom);
    const end = parseDuration(nextTo);
    onChange(start === null || end === null ? null : { start, end });
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="segment-from" className="text-xs">
          {t('audio.segmentFrom')}
        </Label>
        <Input
          id="segment-from"
          value={from}
          placeholder="0:22"
          inputMode="numeric"
          className="w-24"
          onChange={(e) => {
            setFrom(e.target.value);
            push(e.target.value, to);
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="segment-to" className="text-xs">
          {t('audio.segmentTo')}
        </Label>
        <Input
          id="segment-to"
          value={to}
          placeholder="0:48"
          inputMode="numeric"
          className="w-24"
          onChange={(e) => {
            setTo(e.target.value);
            push(from, e.target.value);
          }}
        />
      </div>
      {segment !== null && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setFrom('');
            setTo('');
            onChange(null);
          }}
        >
          {t('audio.segmentClear')}
        </Button>
      )}
    </div>
  );
}
