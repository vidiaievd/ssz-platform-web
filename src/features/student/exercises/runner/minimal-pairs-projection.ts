import {
  DEFAULT_FEEDBACK,
  GLOSS_POLICIES,
  PLAYS_PER_PROBE,
  type Feedback,
  type PlaysPerProbe,
  type StudentProjection,
} from '@/lib/shared-kernel/minimal-pairs';
import type {
  MinimalPairsProbe,
  MinimalPairsProbeVerdict,
  MinimalPairsSubmitDetails,
} from '@/features/student/exercises/types/attempts';

/**
 * Names that belong to the key or to the grading — none may reach a student (plan 72 §3.2): the
 * pairs are the words and the clips, and which clip is which word is the answer; `scoring` holds
 * the pass mark, which comes back only with the result (§5, row 13).
 */
const ROOT_KEY = ['pairs', 'scoring', 'contrastId', 'note', 'passPct'] as const;

/**
 * Accept the set only if what arrived is the student projection.
 *
 * A projection carrying any of `ROOT_KEY` is the stored document — an engine or a route that
 * reached for the authoring copy. Refused rather than stripped, for the reason every server-graded
 * type gives (plan 50's finding): a runner that works over a page holding the key looks exactly
 * like one that does not.
 *
 * The same reader serves the attempt's projection and the reader card's, which reads the display
 * projection content-service hands out before any attempt exists.
 */
export function readMinimalPairsProjection(value: unknown): StudentProjection | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (ROOT_KEY.some((k) => k in raw)) return null;

  const set = record(raw['set']);
  const probes = set['probes'];
  if (typeof probes !== 'number' || !Number.isInteger(probes) || probes < 0) return null;
  const plays = set['playsPerProbe'];

  const contrast = record(raw['contrast']);
  return {
    title: text(raw['title']),
    instruction: text(raw['instruction']),
    language: text(raw['language']),
    contrast: { label: text(contrast['label']), ipa: text(contrast['ipa']) },
    set: {
      probes,
      // Anything out of range is read as the default budget of two: the budget is the
      // runner's, and a wrong guess at «unlimited» would be the one that gives answers away.
      playsPerProbe: (PLAYS_PER_PROBE as readonly unknown[]).includes(plays)
        ? (plays as PlaysPerProbe)
        : 2,
      autoplay: set['autoplay'] !== false,
    },
    feedback: readFeedback(raw['feedback']),
  };
}

/** Listed field by field rather than spread, so a field the runner has no business with cannot ride in. */
function readFeedback(value: unknown): Feedback {
  const f = record(value);
  const gloss = f['showGloss'];
  return {
    immediate: f['immediate'] !== false,
    abCompare: f['abCompare'] !== false,
    showSpelling: f['showSpelling'] === 'always' ? 'always' : 'afterAnswer',
    showGloss: (GLOSS_POLICIES as readonly unknown[]).includes(gloss)
      ? (gloss as Feedback['showGloss'])
      : DEFAULT_FEEDBACK.showGloss,
    showIpa: f['showIpa'] === true,
    secondChance: f['secondChance'] === true,
  };
}

/**
 * The probe `/items` handed out, or `null` when it is not one.
 *
 * Refused outright when a button carries a field it may not — a word id beside it is fine, but
 * a probe naming its own key is not a probe.
 */
export function readProbe(value: unknown): MinimalPairsProbe | null {
  const raw = record(value);
  const n = raw['n'];
  const total = raw['total'];
  const questionId = raw['questionId'];
  if (typeof n !== 'number' || typeof total !== 'number' || typeof questionId !== 'string') {
    return null;
  }
  if ('keyOptionId' in raw || 'wordId' in raw) return null;

  const clip = record(raw['clip']);
  if (typeof clip['url'] !== 'string' || clip['url'] === '') return null;
  const provenance = clip['provenance'];

  if (!Array.isArray(raw['options'])) return null;
  const options: MinimalPairsProbe['options'] = [];
  for (const entry of raw['options'] as unknown[]) {
    const o = record(entry);
    if (typeof o['id'] !== 'string' || o['id'] === '') return null;
    options.push({
      id: o['id'],
      ...(typeof o['text'] === 'string' ? { text: o['text'] } : {}),
      ...(typeof o['gloss'] === 'string' && o['gloss'] !== '' ? { gloss: o['gloss'] } : {}),
      ...(typeof o['ipa'] === 'string' && o['ipa'] !== '' ? { ipa: o['ipa'] } : {}),
    });
  }
  if (options.length < 2) return null;

  const state = record(raw['state']);
  const tries = state['tries'];
  const maxTries = state['maxTries'];
  const closedProbes = Array.isArray(raw['closedProbes'])
    ? (raw['closedProbes'] as unknown[]).flatMap((entry) => {
        const c = record(entry);
        return typeof c['n'] === 'number' && typeof c['correct'] === 'boolean'
          ? [{ n: c['n'], correct: c['correct'] }]
          : [];
      })
    : [];

  return {
    n,
    total,
    questionId,
    clip: {
      url: clip['url'],
      expiresAt: text(clip['expiresAt']),
      durationMs: typeof clip['durationMs'] === 'number' ? clip['durationMs'] : 0,
      provenance: provenance === 'tts' || provenance === 'teacher' ? provenance : 'studio',
      dialect: text(clip['dialect']),
    },
    options,
    state: {
      tries: typeof tries === 'number' ? tries : 0,
      maxTries: typeof maxTries === 'number' && maxTries > 0 ? maxTries : 1,
      closed: false,
    },
    closedProbes,
  };
}

/** One answer's verdict, as `/answers` returned it in `result`, or `null`. */
export function readProbeVerdict(value: unknown): MinimalPairsProbeVerdict | null {
  const r = record(value);
  if (typeof r['questionId'] !== 'string' || typeof r['correct'] !== 'boolean') return null;
  if (typeof r['closed'] !== 'boolean') return null;
  const closed = r['closed'];
  const verdict: MinimalPairsProbeVerdict = {
    questionId: r['questionId'],
    n: typeof r['n'] === 'number' ? r['n'] : 0,
    optionId: text(r['optionId']),
    correct: r['correct'],
    closed,
    tries: typeof r['tries'] === 'number' ? r['tries'] : 1,
    triesLeft: typeof r['triesLeft'] === 'number' ? r['triesLeft'] : 0,
    firstCorrect: r['firstCorrect'] === true,
  };
  // The key and the reveal mean something only on a closed probe; on an open one they are not
  // read even if sent — the screen must not show what the dosing withheld.
  if (!closed) return verdict;
  if (typeof r['keyOptionId'] === 'string') verdict.keyOptionId = r['keyOptionId'];
  if (Array.isArray(r['options'])) {
    verdict.options = (r['options'] as unknown[]).flatMap((entry) => {
      const o = record(entry);
      if (typeof o['id'] !== 'string' || typeof o['text'] !== 'string') return [];
      return [
        {
          id: o['id'],
          text: o['text'],
          ...(typeof o['gloss'] === 'string' && o['gloss'] !== '' ? { gloss: o['gloss'] } : {}),
          ...(typeof o['ipa'] === 'string' && o['ipa'] !== '' ? { ipa: o['ipa'] } : {}),
        },
      ];
    });
  }
  const compare = record(r['compare']);
  if (typeof compare['chosen'] === 'string' && typeof compare['target'] === 'string') {
    verdict.compare = { chosen: compare['chosen'], target: compare['target'] };
  }
  return verdict;
}

/** The result of a sitting from the submit's `details`, or `null`. */
export function readMinimalPairsSummary(value: unknown): MinimalPairsSubmitDetails | null {
  const d = record(value);
  const { right, total, score, passPct } = d;
  if (
    typeof right !== 'number' ||
    typeof total !== 'number' ||
    typeof score !== 'number' ||
    typeof passPct !== 'number' ||
    typeof d['passed'] !== 'boolean'
  ) {
    return null;
  }
  const memory = d['memory'];
  const pairs = Array.isArray(d['pairs'])
    ? (d['pairs'] as unknown[]).flatMap((entry) => {
        const p = record(entry);
        if (typeof p['pairId'] !== 'string' || !Array.isArray(p['words'])) return [];
        const words = (p['words'] as unknown[]).filter((w): w is string => typeof w === 'string');
        const clips = Array.isArray(p['clips'])
          ? (p['clips'] as unknown[]).map((c) => (typeof c === 'string' ? c : ''))
          : [];
        return [
          {
            pairId: p['pairId'],
            words,
            played: typeof p['played'] === 'number' ? p['played'] : 0,
            correct: typeof p['correct'] === 'number' ? p['correct'] : 0,
            clips,
          },
        ];
      })
    : [];
  return {
    right,
    total,
    score,
    passed: d['passed'],
    passPct,
    ...(memory === 'contrast' || memory === 'contrast+word' || memory === 'none' ? { memory } : {}),
    pairs,
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
