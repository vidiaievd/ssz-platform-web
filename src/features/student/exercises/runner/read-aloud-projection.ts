import {
  DEFAULT_RECORDING,
  isMode,
  RA_MAX_TAKES,
  type ProjectedCriterion,
  type ProjectedPrompt,
  type Recording,
  type StudentProjection,
} from '@/lib/shared-kernel/read-aloud';

/**
 * Accept the exercise only if what arrived is the student projection (plan 70 §3.2, RA-M5).
 *
 * The listening note, the focus words, the pass mark and the AI stage live on the key side. Any
 * of them on the wire means the stored document reached the browser — an engine or a content
 * service older than phases 4–5, or a route that reached for the authoring copy — and the
 * answer is to refuse, not to strip (plan 50's finding, repeated by every type since): a
 * stripped document gives a runner that works and nothing on any screen to say the key left.
 *
 * Rubric descriptors are the one key-side field allowed through, and only as the projection
 * puts them: under `showRubric: 'always'`, for the criteria the student may see.
 */
export function readReadAloudProjection(value: unknown): StudentProjection | null {
  if (!isRecord(value)) return null;
  if ('expected' in value || 'expectedAnswers' in value || 'review' in value) return null;
  if (!isMode(value['mode']) || !Array.isArray(value['prompts'])) return null;

  const prompts: ProjectedPrompt[] = [];
  for (const raw of value['prompts']) {
    const prompt = readPrompt(raw);
    if (prompt === null) return null;
    prompts.push(prompt);
  }

  const s = isRecord(value['settings']) ? value['settings'] : {};
  if ('passScore' in s) return null;
  const settings: StudentProjection['settings'] = {
    showRubric:
      s['showRubric'] === 'always' || s['showRubric'] === 'never' ? s['showRubric'] : 'afterGraded',
    showModel: s['showModel'] === 'never' ? 'never' : 'afterGraded',
    revision: s['revision'] === 'once' ? 'once' : 'return',
  };

  let rubric: ProjectedCriterion[] | undefined;
  if (value['rubric'] !== undefined) {
    // Descriptors before the verdict only when the author asked for the rubric to be shown.
    if (settings.showRubric !== 'always' || !Array.isArray(value['rubric'])) return null;
    rubric = [];
    for (const raw of value['rubric']) {
      const c = readCriterion(raw);
      if (c === null) return null;
      rubric.push(c);
    }
  }

  return {
    title: str(value['title']),
    instruction: str(value['instruction']),
    language: str(value['language']),
    mode: value['mode'],
    prompts,
    recording: readRecording(value['recording']),
    settings,
    ...(rubric === undefined ? {} : { rubric }),
  };
}

function readPrompt(raw: unknown): ProjectedPrompt | null {
  if (!isRecord(raw)) return null;
  if ('note' in raw || 'focus' in raw) return null;
  const { id } = raw;
  if (typeof id !== 'string' || id === '') return null;

  const min = seconds(raw['minSeconds']);
  const max = seconds(raw['maxSeconds']);
  const prep = seconds(raw['prepSeconds']);
  if (min === null || max === null || prep === null || max <= 0) return null;

  const out: ProjectedPrompt = {
    id,
    label: str(raw['label']),
    minSeconds: min,
    maxSeconds: max,
    prepSeconds: prep,
  };
  if (typeof raw['text'] === 'string') out.text = raw['text'];
  if (isRecord(raw['image']) && typeof raw['image']['assetId'] === 'string') {
    out.image = {
      assetId: raw['image']['assetId'],
      caption: str(raw['image']['caption']),
      alt: str(raw['image']['alt']),
    };
  }
  if (Array.isArray(raw['plan'])) {
    out.plan = raw['plan'].flatMap((p) =>
      isRecord(p) && typeof p['id'] === 'string' && typeof p['text'] === 'string'
        ? [{ id: p['id'], text: p['text'], required: p['required'] === true }]
        : [],
    );
  }
  if (isRecord(raw['turn'])) {
    out.turn = { situation: str(raw['turn']['situation']), partner: str(raw['turn']['partner']) };
  }
  return out;
}

function readCriterion(raw: unknown): ProjectedCriterion | null {
  if (!isRecord(raw) || typeof raw['id'] !== 'string') return null;
  // A weight or a visibility flag is the authoring copy, not the student's.
  if ('weight' in raw || 'studentVisible' in raw) return null;
  const levels = Array.isArray(raw['levels']) ? raw['levels'] : [];
  return {
    id: raw['id'],
    name: str(raw['name']),
    desc: str(raw['desc']),
    levels: [0, 1, 2, 3].map((i) => str(levels[i])) as [string, string, string, string],
  };
}

/** Field by field: a field the runner has no business with cannot ride in. */
function readRecording(raw: unknown): Recording {
  const r = isRecord(raw) ? raw : {};
  const takes = r['takes'];
  const flag = (key: keyof Recording) =>
    typeof r[key] === 'boolean' ? (r[key] as boolean) : (DEFAULT_RECORDING[key] as boolean);
  return {
    takes:
      typeof takes === 'number' && Number.isInteger(takes) && takes >= 1 && takes <= RA_MAX_TAKES
        ? takes
        : DEFAULT_RECORDING.takes,
    chooseBest: flag('chooseBest'),
    listenBack: flag('listenBack'),
    countdown: flag('countdown'),
    micCheck: flag('micCheck'),
    keepAllTakes: flag('keepAllTakes'),
  };
}

function seconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
