// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
// Source: ssz-platform/packages/shared-kernel/src/skills/index.ts
// Regenerate with `npm run kernel:sync`; verify with `npm run kernel:check`.
// ---------------------------------------------------------------------------

// Public surface of the skill axes — plan 55 phase 1.

export type { Focus, FocusSource, Form, Skill, SkillSource } from './model';
export {
  FOCUS_SOURCES,
  FOCUSES,
  FORMS,
  isFocus,
  isSkill,
  orderFocuses,
  orderSkills,
  parseFocuses,
  parseSkills,
  SKILL_SOURCES,
  SKILLS,
} from './model';

export type { TemplateProfile } from './by-template';
export { BY_TEMPLATE, templateProfile } from './by-template';

export type { AtomRef, DeriveInput, DerivedProfile, Placement, SkillOverride } from './derive';
export { deriveSkills } from './derive';

export type {
  Coverage,
  CoverageDifference,
  FocusTally,
  FormTally,
  SkillTally,
} from './coverage';
export { coverage, diff, diverges, share, tally } from './coverage';

export type { CoverageIssue, CoverageIssueLevel, CoverageIssueOptions } from './issues';
export { coverageIssues, warnings } from './issues';
