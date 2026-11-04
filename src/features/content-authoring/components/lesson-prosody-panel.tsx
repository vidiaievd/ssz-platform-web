'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCan } from '@/features/entitlements';
import type { Sentence } from '@/lib/shared-kernel/text/sentences';

import {
  loadLessonProsodyAction,
  saveLessonProsodyAction,
  suggestLessonProsodyAction,
} from '../actions/prosody';
import { EditorCard } from './editor-card';
import { Callout } from './highlight-in-text/parts';
import {
  LayerSaveLine,
  ProsodyEditor,
  useProsodyLayers,
  type ProsodyLayerApi,
} from './prosody-editor';

/** A line that is nothing but media tokens — `![alt](media://…)`, `[audio:… "…"]`, `[video:…]`. */
const MEDIA_LINE = /^\s*(?:(?:!\[[^\]]*\]\(media:\/\/[^)]*\)|\[(?:audio|video):[^\]]*\])\s*)+$/;

interface LessonProsodyPanelProps {
  lessonId: string;
  /** Undefined until the body has been saved at least once (no variant yet). */
  variantId: string | undefined;
  /** The body as saved — the text the server anchors the marks to. */
  savedBody: string;
  /** The body in the field now; marks wait while it differs from the saved one. */
  body: string;
  lang?: string;
}

/**
 * «Pronunciation» of a TEXT lesson (plan 86, step 6h.4): the shared `ProsodyEditor` over the
 * whole body, the same marks the reader shows in its «Pronunciation» mode.
 *
 * No switch and no blockers, unlike the read_aloud builder: the lesson body is not versioned
 * and the learner picks the mode, so the marks are an option the author may leave alone. They
 * lie on the **saved** body, and the lesson editor saves its text by hand — so the editor
 * waits while the field holds unsaved text, and reads again once the save lands.
 *
 * Collapsed until opened: opening reads the lexicon for the whole body (ai-service).
 */
export function LessonProsodyPanel({
  lessonId,
  variantId,
  savedBody,
  body,
  lang,
}: LessonProsodyPanelProps) {
  const t = useTranslations('Authoring.lessonProsody');
  // ✦ spends the owner's `ai.authoring` credits; without the key the agent would refuse it.
  const can = useCan();
  const [open, setOpen] = useState(false);

  const api = useMemo<ProsodyLayerApi | null>(
    () =>
      variantId === undefined
        ? null
        : {
            load: () => loadLessonProsodyAction(lessonId, variantId),
            save: (_, input) => saveLessonProsodyAction(lessonId, variantId, input),
            suggest: () => suggestLessonProsodyAction(lessonId, variantId),
          },
    [lessonId, variantId],
  );
  const passages = useMemo(
    () => (variantId === undefined ? [] : [{ id: variantId, text: savedBody }]),
    [variantId, savedBody],
  );
  const layers = useProsodyLayers({
    api: api ?? NO_API,
    passages,
    on: open && api !== null,
    revision: savedBody,
  });

  // A sentence starts at its first word (`Bergen` in `![Bergen](…)`): judge the line it is on.
  const showSentence = useMemo(
    () => (sentence: Sentence) => {
      const from = savedBody.lastIndexOf('\n', sentence.s - 1) + 1;
      const to = savedBody.indexOf('\n', sentence.e);
      return !MEDIA_LINE.test(savedBody.slice(from, to === -1 ? undefined : to));
    },
    [savedBody],
  );

  const id = variantId ?? '';
  const state = layers.byPassage[id];
  const view = state?.status === 'loaded' ? state.view : null;
  const layer = layers.layerOf(id);
  const unsaved = body !== savedBody;

  const content = () => {
    if (variantId === undefined || savedBody.trim() === '' || state?.status === 'absent') {
      return <p className="m-0 text-sm text-muted-foreground">{t('noText')}</p>;
    }
    if (unsaved) return <Callout tone="info">{t('unsaved')}</Callout>;
    if (state?.status === 'failed') {
      return (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto self-start p-0"
          onClick={() => layers.reload(id)}
        >
          <RotateCw className="size-3.5" aria-hidden />
          {t('failed')}
        </Button>
      );
    }
    if (view === null || view.text !== savedBody) {
      return <p className="m-0 text-sm text-muted-foreground">{t('loading')}</p>;
    }
    const unresolved = view.lexicon.unresolved;
    return (
      <>
        {unresolved.length > 0 && (
          <p className="m-0 text-sm text-(--ssz-text-secondary)">
            {t('unresolved', { words: unresolved.map((word) => word.w).join(', ') })}
          </p>
        )}
        {layer !== null && (
          <ProsodyEditor
            text={view.text}
            layer={layer}
            lexicon={view.lexicon}
            needs={NO_NEEDS}
            lang={lang}
            textIn="lessonBody"
            showSentence={showSentence}
            onChange={(next) => layers.edit(id, next)}
            onSuggest={can('ai.authoring') ? () => layers.suggest(id) : undefined}
          />
        )}
        <p className="m-0 text-xs text-muted-foreground">{t('appliesNow')}</p>
        <LayerSaveLine state={layers.saves[id]} onRetry={() => layers.retry(id)} />
      </>
    );
  };

  return (
    <EditorCard
      title={t('title')}
      right={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t('hide') : t('show')}
          <ChevronDown
            className={
              open ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'
            }
            aria-hidden
          />
        </Button>
      }
    >
      <p className="m-0 text-sm text-muted-foreground">{t('lede')}</p>
      {open && <div className="mt-3.5 flex flex-col gap-3">{content()}</div>}
    </EditorCard>
  );
}

const NO_NEEDS: never[] = [];

/** Before the first save there is no variant to read; `on` is off, so this is never called. */
const NO_API: ProsodyLayerApi = {
  load: () => Promise.reject(new Error('no lesson variant')),
  save: () => Promise.reject(new Error('no lesson variant')),
  suggest: () => Promise.reject(new Error('no lesson variant')),
};
