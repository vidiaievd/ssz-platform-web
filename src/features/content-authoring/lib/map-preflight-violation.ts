import type { CheckSeverity, PreflightCheck } from '../types';

export interface RuleViolation {
  ruleCode: string;
  severity: 'blocker' | 'warning';
  itemType: string;
  itemId: string;
  detail: string;
}

interface RuleMeta {
  title: string;
  fixHint?: string;
}

// content-service's `get-preflight.handler.ts` rule codes (BE5.1). Keep in sync
// with that file's `ruleCode` literals if new rules are added there.
const RULE_META: Record<string, RuleMeta> = {
  EMPTY_VERSION: { title: 'This draft has no content', fixHint: 'Add at least one lesson before publishing' },
  VIDEO_NO_SOURCE: { title: 'Video lesson has no video source', fixHint: 'Upload a video in the lesson editor' },
  AUDIO_NO_TRACK: { title: 'Audio lesson has no audio track', fixHint: 'Upload an audio file in the lesson editor' },
  AUDIO_NO_TRANSCRIPT: { title: 'Audio lesson has no transcript', fixHint: 'Add a transcript in the lesson editor' },
  MODULE_EMPTY: { title: 'A module has no lessons', fixHint: 'Add at least one lesson to this module' },
  SECTION_EMPTY: { title: 'A section has no items', fixHint: 'Add a lesson to this section, or remove it' },
  DRAFT_ITEM: { title: 'Grammar rule has no published explanation', fixHint: 'Publish an explanation for this rule' },
  READ_NO_TITLE: { title: 'Lesson has no published content', fixHint: "Publish this lesson's content" },
  MEDIA_NO_ALT: { title: 'Lesson image is missing alt text', fixHint: 'Add alt text to every image' },
  LEVEL_NO_TEACHER: { title: 'Level has no assigned teacher', fixHint: 'Assign a teacher to this level' },
  LIVE_NO_SCHEDULE: { title: 'Live lesson has no scheduled time', fixHint: 'Set a date and time for this session' },
  VOCAB_NO_TRANSLATION: { title: 'Vocabulary item has no translation', fixHint: 'Add a translation' },
  VOCAB_NO_AUDIO: { title: 'Vocabulary item has no pronunciation audio', fixHint: 'Upload pronunciation audio' },
  EXERCISE_INCOMPLETE: { title: 'Exercise has no instructions', fixHint: 'Add instruction text' },
  NO_GRAMMAR: { title: 'Course has no grammar content', fixHint: 'Add at least one grammar rule' },
  EXERCISE_COUNT_LOW: { title: 'Course has very few exercises', fixHint: 'Add more practice exercises' },
  LOCALE_INCOMPLETE: { title: 'Missing translations for some UI languages', fixHint: 'Add the missing localizations' },
};

/**
 * Deep links only exist for entities with a real dedicated editor route today
 * (lessons, modules). Everything else falls back to the course's own structure
 * page — better than a dead link, but not a precise jump-to-fix.
 */
function resolveFixDeepLink(
  v: RuleViolation,
  ctx: { schoolSlug: string; containerId: string },
): string | null {
  const courseBase = `/school/${ctx.schoolSlug}/content/${ctx.containerId}`;

  if (v.itemType === 'LESSON') {
    return `${courseBase}/lessons/${v.itemId}`;
  }
  if (v.itemType === 'CONTAINER' && v.ruleCode === 'MODULE_EMPTY') {
    return `/school/${ctx.schoolSlug}/content/${v.itemId}`;
  }
  return courseBase;
}

export function mapPreflightViolation(
  v: RuleViolation,
  ctx: { schoolSlug: string; containerId: string },
): PreflightCheck {
  const meta = RULE_META[v.ruleCode];
  return {
    id: `${v.ruleCode}:${v.itemId}`,
    severity: v.severity as CheckSeverity,
    title: meta?.title ?? v.detail,
    fixHint: meta?.fixHint ?? v.detail,
    fixDeepLink: resolveFixDeepLink(v, ctx),
  };
}
