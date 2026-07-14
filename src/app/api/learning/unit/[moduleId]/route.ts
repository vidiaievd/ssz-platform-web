import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  ExpandedModule,
  ExpandedVocabItem,
  ModuleProgress,
  UnitPayload,
} from '@/features/learning/types';

/**
 * Wire shape of a vocabulary item as content-service emits it from
 * `GET /internal/modules/:id/expanded` (see content-service
 * get-expanded-module.handler.ts → VocabItemExpanded). Field names differ from
 * the web-facing ExpandedVocabItem, so we map explicitly below.
 */
interface ContentVocabItem {
  id: string;
  word: string;
  partOfSpeech: string | null;
  ipaTranscription: string | null;
  pronunciationAudioMediaId: string | null;
  grammaticalProperties: Record<string, unknown> | null;
  translation: { language: string; text: string; definition: string | null } | null;
  usageExample: { text: string } | null;
}

/** Content-service expanded-module payload (partial — only the fields we remap here). */
interface ContentExpandedModulePayload {
  vocabItems: ContentVocabItem[];
}

/**
 * content-service emits partOfSpeech as the Prisma enum name (e.g. `NOUN`,
 * `ADJECTIVE`); the web UI keys off short lowercase tokens (`noun`, `verb`,
 * `adj`). Normalise here so both the tag pill and the forms table agree.
 */
function normalizePos(pos: string | null): string {
  if (!pos) return '';
  const lower = pos.toLowerCase();
  if (lower === 'adjective') return 'adj';
  return lower;
}

/** Coerce the untyped grammaticalProperties JSONB into a flat string map for the UI. */
function mapGrammaticalProperties(
  props: Record<string, unknown> | null,
): Record<string, string> | undefined {
  if (!props) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Map a content-service vocab item to the web-facing ExpandedVocabItem. */
function mapVocabItem(item: ContentVocabItem): ExpandedVocabItem {
  return {
    id: item.id,
    word: item.word,
    pos: normalizePos(item.partOfSpeech),
    ipa: item.ipaTranscription ?? undefined,
    // pronunciationAudioMediaId is a media id, not a URL — audio resolution is
    // a separate concern (media-service); left undefined until wired.
    audioUrl: undefined,
    translation: item.translation?.text ?? '',
    example: item.usageExample?.text ?? undefined,
    grammaticalProperties: mapGrammaticalProperties(item.grammaticalProperties),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  const { moduleId } = await params;

  try {
    const [rawModule, progress] = await Promise.all([
      serverFetch<ContentExpandedModulePayload & ExpandedModule>({
        service: 'content',
        path: `/internal/modules/${moduleId}/expanded`,
      }),
      serverFetch<ModuleProgress>({
        service: 'progress',
        path: `/progress/modules/${moduleId}`,
      }),
    ]);

    // NOTE: the content-service ExpandedModulePayload shape does not fully match
    // the web ExpandedModule — module-level fields (title vs moduleTitle,
    // position, cefrLevel, canDoDescriptors, grammar single-vs-array, lesson and
    // exercise field names) still need a dedicated BFF reconciliation task.
    // This handler currently reconciles only the vocabulary array, which is what
    // the vocab-forms feature requires; the rest is passed through unchanged.
    const { vocabItems, ...restModule } = rawModule;
    const mappedModule: ExpandedModule = {
      ...restModule,
      vocabulary: (vocabItems ?? []).map(mapVocabItem),
    };

    const payload: UnitPayload = { module: mappedModule, progress };
    return NextResponse.json(payload);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load unit' }, { status: 502 });
  }
}
