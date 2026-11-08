import { parsePrecheckResult } from '@/features/student/precheck';

import type {
  DoneReason,
  Melody,
  Rating,
  ReferenceClip,
  SessionBudget,
  SessionItems,
  SessionResult,
  SessionStep,
  SoundInstruction,
  SoundSession,
  SoundStatus,
  StepEvent,
  TakeResult,
} from './types';

/**
 * Silence instead of invention, as everywhere a model-adjacent answer is read (plan 48 §6.4):
 * what cannot be read in full is `null`, and the screen says «try again» rather than guess.
 */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const DONE: readonly string[] = ['finished', 'take_limit', 'stopped', 'pool_empty', 'not_available'];
const STATUS: readonly string[] = ['pending', 'open', 'passed', 'failed'];

function doneReason(v: unknown): DoneReason | null {
  return typeof v === 'string' && DONE.includes(v) ? (v as DoneReason) : null;
}

function parseStep(raw: unknown): SessionStep | null {
  if (!isRec(raw)) return null;
  const atomId = str(raw.atomId);
  const family = str(raw.family);
  const sentence = str(raw.sentence);
  if (atomId === null || family === null || sentence === null) return null;
  if (raw.phase === 'diagnostic') {
    const word = str(raw.word);
    const index = num(raw.index);
    const total = num(raw.total);
    if (word === null || index === null || total === null) return null;
    return { phase: 'diagnostic', atomId, family, index, total, word, sentence };
  }
  if (raw.phase !== 'drill' || !isRec(raw.element)) return null;
  const e = raw.element;
  const elementIndex = num(raw.elementIndex);
  if (elementIndex === null) return null;
  let element: Extract<SessionStep, { phase: 'drill' }>['element'] | null = null;
  if (e.kind === 'word' && typeof e.word === 'string') element = { kind: 'word', word: e.word };
  else if (e.kind === 'phrase' && typeof e.text === 'string') element = { kind: 'phrase', text: e.text };
  else if (
    e.kind === 'pair' &&
    Array.isArray(e.words) &&
    typeof e.words[0] === 'string' &&
    typeof e.words[1] === 'string'
  ) {
    element = {
      kind: 'pair',
      words: [e.words[0], e.words[1]],
      judged: Array.isArray(e.judged) ? e.judged.filter((n): n is number => typeof n === 'number') : [],
    };
  }
  if (element === null) return null;
  return {
    phase: 'drill',
    atomId,
    family,
    elementIndex,
    element,
    say: str(raw.say),
    sentence,
    fails: num(raw.fails) ?? 0,
  };
}

export function parseSession(raw: unknown): SoundSession | null {
  if (!isRec(raw)) return null;
  const attemptId = str(raw.attemptId);
  const language = str(raw.language);
  const takes = num(raw.takes);
  const maxTakes = num(raw.maxTakes);
  const takeIndex = num(raw.takeIndex);
  if (attemptId === null || language === null || takes === null || maxTakes === null || takeIndex === null) {
    return null;
  }
  if (raw.phase !== 'diagnostic' && raw.phase !== 'drill' && raw.phase !== 'done') return null;
  const basis = raw.basis === 'chosen' || raw.basis === 'record' || raw.basis === 'diagnostic' ? raw.basis : 'record';
  const sounds: SoundSession['sounds'] = [];
  for (const s of Array.isArray(raw.sounds) ? raw.sounds : []) {
    if (!isRec(s) || typeof s.atomId !== 'string' || !STATUS.includes(String(s.status))) continue;
    sounds.push({ atomId: s.atomId, family: str(s.family) ?? '', status: s.status as SoundStatus });
  }
  const d = isRec(raw.diagnostic) ? raw.diagnostic : null;
  const measured = d === null ? null : num(d.measured);
  const total = d === null ? null : num(d.total);
  const step = parseStep(raw.step);
  // A live session with nothing to say is broken, not finished.
  if (raw.phase !== 'done' && step === null) return null;
  return {
    attemptId,
    resumed: raw.resumed === true,
    language,
    basis,
    phase: raw.phase,
    doneReason: doneReason(raw.doneReason),
    takes,
    maxTakes,
    takeIndex,
    sounds,
    diagnostic: measured !== null && total !== null ? { measured, total } : null,
    step,
  };
}

function parseBudget(raw: unknown): SessionBudget | null {
  if (!isRec(raw) || (raw.payer !== 'school' && raw.payer !== 'learner')) return null;
  const credits = (v: unknown) => (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    payer: raw.payer,
    metered: raw.metered === true,
    remainingCredits: credits(raw.remainingCredits),
    estimatedCredits: credits(raw.estimatedCredits),
  };
}

export function parseStart(raw: unknown): { session: SoundSession; budget: SessionBudget | null } | null {
  const session = parseSession(raw);
  if (session === null || !isRec(raw)) return null;
  return { session, budget: parseBudget(raw.budget) };
}

function parseClips(raw: unknown): ReferenceClip[] {
  const clips: ReferenceClip[] = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!isRec(c) || typeof c.word !== 'string' || typeof c.url !== 'string') continue;
    clips.push({ word: c.word, url: c.url, mimeType: str(c.mimeType) ?? 'audio/mpeg' });
  }
  return clips;
}

function parseInstruction(raw: unknown): SoundInstruction | null {
  if (!isRec(raw) || typeof raw.atomId !== 'string' || typeof raw.howTo !== 'string') return null;
  return {
    atomId: raw.atomId,
    title: str(raw.title) ?? '',
    howTo: raw.howTo,
    drill: str(raw.drill),
    commonError: str(raw.commonError),
    ukNote: str(raw.ukNote),
  };
}

export function parseItems(raw: unknown): SessionItems | null {
  if (!isRec(raw)) return null;
  const session = parseSession(raw.session);
  if (session === null) return null;
  return { session, clips: parseClips(raw.clips), instruction: parseInstruction(raw.instruction) };
}

function parseEvents(raw: unknown): StepEvent[] {
  const events: StepEvent[] = [];
  for (const e of Array.isArray(raw) ? raw : []) {
    if (!isRec(e)) continue;
    switch (e.kind) {
      case 'retry':
      case 'side_passed':
      case 'element_passed':
      case 'sound_failed':
      case 'sound_passed':
        if (typeof e.atomId === 'string') events.push({ kind: e.kind, atomId: e.atomId });
        break;
      case 'diagnostic_measured':
        if (typeof e.atomId === 'string') events.push({ kind: e.kind, atomId: e.atomId, weak: e.weak === true });
        break;
      case 'diagnostic_done':
        events.push({
          kind: e.kind,
          weak: Array.isArray(e.weak) ? e.weak.filter((w): w is string => typeof w === 'string') : [],
        });
        break;
      case 'session_done': {
        const reason = doneReason(e.reason);
        if (reason !== null) events.push({ kind: e.kind, reason });
        break;
      }
    }
  }
  return events;
}

function parseMelody(raw: unknown): Melody | null {
  if (!isRec(raw)) return null;
  const stepMs = num(raw.stepMs);
  const curve = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : null)) : null;
  const learner = curve(raw.learner);
  const reference = curve(raw.reference);
  if (stepMs === null || stepMs <= 0 || learner === null || reference === null) return null;
  return { stepMs, learner, reference };
}

export function parseTake(raw: unknown): TakeResult | null {
  if (!isRec(raw)) return null;
  if (raw.outcome !== 'judged' && raw.outcome !== 'stopped' && raw.outcome !== 'retry') return null;
  const session = parseSession(raw.session);
  if (session === null) return null;
  const v = isRec(raw.verdict) ? raw.verdict : null;
  const t = isRec(raw.toneme) ? raw.toneme : null;
  const melody = t === null ? null : parseMelody(t.melody);
  const feedback =
    raw.feedback == null ? null : (parsePrecheckResult({ ai: { status: 'ok' }, feedback: raw.feedback })?.feedback ?? null);
  return {
    outcome: raw.outcome,
    reason: str(raw.reason),
    verdict:
      v === null
        ? null
        : {
            measured: v.measured === true,
            passed: typeof v.passed === 'boolean' ? v.passed : null,
            key: str(v.key),
          },
    feedback,
    toneme:
      t !== null && melody !== null && (t.tone === 1 || t.tone === 2) && typeof t.verdict === 'string'
        ? { tone: t.tone, verdict: t.verdict, melody }
        : null,
    events: parseEvents(raw.events),
    session,
  };
}

export function parseResult(raw: unknown): SessionResult | null {
  if (!isRec(raw)) return null;
  const sounds: SessionResult['sounds'] = [];
  for (const s of Array.isArray(raw.sounds) ? raw.sounds : []) {
    if (!isRec(s) || typeof s.atomId !== 'string' || !STATUS.includes(String(s.status))) continue;
    const rating = s.rating === 'GOOD' || s.rating === 'HARD' || s.rating === 'AGAIN' ? (s.rating as Rating) : null;
    sounds.push({
      atomId: s.atomId,
      status: s.status as SoundStatus,
      passes: num(s.passes) ?? 0,
      fails: num(s.fails) ?? 0,
      rating,
    });
  }
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    score: num(raw.score),
    doneReason: doneReason(raw.doneReason),
    sounds,
    diagnosticWeak: strings(raw.diagnosticWeak),
    flagged: strings(raw.flagged),
  };
}
