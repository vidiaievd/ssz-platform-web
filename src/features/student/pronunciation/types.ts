import type { Feedback } from '@/features/student/precheck';

/** What the learner is to say now (platform `StepView`, plan 86 step 13.4). */
export type SessionStep =
  | {
      phase: 'diagnostic';
      atomId: string;
      family: string;
      index: number;
      total: number;
      word: string;
      sentence: string;
    }
  | {
      phase: 'drill';
      atomId: string;
      family: string;
      elementIndex: number;
      element:
        | { kind: 'word'; word: string }
        | { kind: 'pair'; words: [string, string]; judged: number[] }
        | { kind: 'phrase'; text: string };
      /** The word of this take; null for a phrase. */
      say: string | null;
      sentence: string;
      fails: number;
    };

export type SoundStatus = 'pending' | 'open' | 'passed' | 'failed';

export type DoneReason = 'finished' | 'take_limit' | 'stopped' | 'pool_empty' | 'not_available';

export interface SoundSession {
  attemptId: string;
  resumed: boolean;
  language: string;
  basis: 'chosen' | 'record' | 'diagnostic';
  phase: 'diagnostic' | 'drill' | 'done';
  doneReason: DoneReason | null;
  takes: number;
  maxTakes: number;
  /** Sent back with a take; another one answers 409. */
  takeIndex: number;
  sounds: Array<{ atomId: string; family: string; status: SoundStatus }>;
  diagnostic: { measured: number; total: number } | null;
  step: SessionStep | null;
}

/** What one session may cost; warn only when the learner pays and the rest is under the estimate. */
export interface SessionBudget {
  payer: 'school' | 'learner';
  metered: boolean;
  remainingCredits: number | null;
  estimatedCredits: number | null;
}

export interface ReferenceClip {
  word: string;
  url: string;
  mimeType: string;
}

/** The base's words about a sound, in the interface language. */
export interface SoundInstruction {
  atomId: string;
  title: string;
  howTo: string;
  drill: string | null;
  commonError: string | null;
  ukNote: string | null;
}

export interface SessionItems {
  session: SoundSession;
  clips: ReferenceClip[];
  instruction: SoundInstruction | null;
}

export type StepEvent =
  | { kind: 'retry' | 'side_passed' | 'element_passed' | 'sound_failed' | 'sound_passed'; atomId: string }
  | { kind: 'diagnostic_measured'; atomId: string; weak: boolean }
  | { kind: 'diagnostic_done'; weak: string[] }
  | { kind: 'session_done'; reason: DoneReason };

/** Pitch curves, one value per `stepMs`, `null` where there is no voiced sound. */
export interface Melody {
  stepMs: number;
  learner: Array<number | null>;
  reference: Array<number | null>;
}

export interface TakeVerdict {
  measured: boolean;
  passed: boolean | null;
  /** The kind of miss (`KJ:major`, `TONE:1`). */
  key: string | null;
}

export interface TakeResult {
  outcome: 'judged' | 'stopped' | 'retry';
  reason: string | null;
  verdict: TakeVerdict | null;
  feedback: Feedback | null;
  toneme: { tone: 1 | 2; verdict: string; melody: Melody } | null;
  events: StepEvent[];
  session: SoundSession;
}

export type Rating = 'GOOD' | 'HARD' | 'AGAIN';

export interface SessionResult {
  score: number | null;
  doneReason: DoneReason | null;
  sounds: Array<{ atomId: string; status: SoundStatus; passes: number; fails: number; rating: Rating | null }>;
  diagnosticWeak: string[];
  flagged: string[];
}
