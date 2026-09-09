/**
 * Urgency as a continuous quantity — the single source of colour in the review system.
 *
 * There are no "overdue" badges anywhere in this subsystem, and the reason is a school
 * coming back from the holidays: a list where every row is red says nothing at all. What
 * says something is how far past the promise each submission is relative to the others,
 * so age against the promised response time drives both a colour and a width, and the two
 * together survive a queue that is entirely late.
 *
 * The formula is `DATA_MODEL.md` §5 of the review handoff, transcribed rather than
 * reinvented: the prototype, this module, the histogram and the oversight screen must
 * agree to the digit, or the same submission reads as two different urgencies on two
 * screens.
 *
 * Age in words does not live here. It is localised (`Intl.RelativeTimeFormat`, the
 * `Review.age.*` keys) and belongs to the component that renders it; these functions stay
 * pure so they can be tested at the boundaries and called during layout.
 */

/** Past this multiple of the promise, nothing gets redder — see `ratio`. */
const CEILING = 2;

/**
 * Age as a fraction of the promised response time, clamped to 0…2.
 *
 * The clamp is the point, not a safety measure. Everything older than twice the promise
 * looks the same because the difference between five days late and nine days late has
 * stopped carrying a decision: both mean "this should have been answered", and colouring
 * them apart would spend the top of the scale on a distinction nobody acts on.
 *
 * A non-positive `slaHours` would divide by zero or invert the scale; it is read as "no
 * promise was made", which puts the submission at the fresh end rather than the alarming
 * one.
 */
export function ratio(hours: number, slaHours: number): number {
  if (!Number.isFinite(hours) || !Number.isFinite(slaHours) || slaHours <= 0) return 0;
  return Math.max(0, Math.min(hours / slaHours, CEILING));
}

/**
 * The colour of that ratio: warm grey when fresh, amber at the promise, red at twice it.
 *
 * Hue turns twice as fast after the promise passes as before it (102 → 82 over the first
 * multiple, 82 → 22 over the second), so crossing the promise is visible as a change of
 * character and not only of shade.
 */
export function ageTone(hours: number, slaHours: number): string {
  const r = ratio(hours, slaHours);
  const { hue, chroma } = scalePoint(r);
  const lightness = 0.685 - (0.095 * Math.min(r, CEILING)) / CEILING;
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(0)})`;
}

/** Hue and chroma at a point on the scale — everything but how light it is rendered. */
function scalePoint(r: number): { hue: number; chroma: number } {
  return {
    hue: r <= 1 ? 102 - 20 * r : 82 - 60 * (r - 1),
    chroma: 0.012 + (0.115 * Math.min(r, 1.9)) / 1.9,
  };
}

/**
 * The same point on the scale, rendered light enough to read as 12px text.
 *
 * `ageTone` is built for a rail: a filled shape a few pixels wide, where lightness 0.6 is
 * exactly right and contrast rules ask 3:1 of it. The same value as text fails at 4.5:1,
 * which is why the design system carries `-700` tiers beside its `-500` fills — this is
 * that tier, computed rather than enumerated, because the hue here is continuous.
 *
 * Two values, not one: the app's theme is a class on the root and not the OS preference,
 * so `light-dark()` would follow the wrong signal (see the note atop `globals.css`). The
 * component publishes both and `.ssz-age-text` picks.
 */
export function ageTextTone(hours: number, slaHours: number): { light: string; dark: string } {
  const { hue, chroma } = scalePoint(ratio(hours, slaHours));
  const c = chroma.toFixed(3);
  const h = hue.toFixed(0);
  return { light: `oklch(0.450 ${c} ${h})`, dark: `oklch(0.800 ${c} ${h})` };
}

/**
 * The width of the rail down the left of a row, 3 px fresh to 6 px at twice the promise.
 *
 * Width rather than a second colour: it is the part of the signal that survives both a
 * monochrome screen and a reader who does not distinguish amber from red.
 */
export function ageRail(hours: number, slaHours: number): number {
  return 3 + (3 * ratio(hours, slaHours)) / CEILING;
}

/**
 * Whether the promise has been broken.
 *
 * Strictly greater: a submission that has just reached the promise has been answered
 * within it. Used for the "longer than promised" filter and for the dot beside the
 * sidebar count — never to move a row somewhere else, which is how a queue grows a tab
 * nobody opens.
 */
export function isOverdue(hours: number, slaHours: number): boolean {
  if (!Number.isFinite(hours) || !Number.isFinite(slaHours) || slaHours <= 0) return false;
  return hours > slaHours;
}

/** Hours between a submission time and now — the input every function here takes. */
export function hoursSince(submittedAt: string | Date, now: Date = new Date()): number {
  const at = typeof submittedAt === 'string' ? new Date(submittedAt) : submittedAt;
  const ms = now.getTime() - at.getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 3_600_000) : 0;
}
