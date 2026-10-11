import type { ProjectedField, StudentProjection } from '@/lib/shared-kernel/information-transfer';
import {
  ATTEMPTS,
  FIELD_TYPES,
  HINTS_AFTER,
  LAYOUTS,
  REVEAL_KEYS,
  SHOW_SOURCES,
  SOURCE_KINDS,
} from '@/lib/shared-kernel/information-transfer';

/**
 * Accept the blank only if what arrived is the student projection (plan 73 §3.2).
 *
 * The key is made of what the other column holds: a field that carries `expected`, `why`,
 * `required` or `focus`, a delivery block that carries the pass mark, a document with the
 * grading or memory settings. Any of them on the wire means the stored document reached the
 * browser — an engine older than phase 4, or a route that reached for the authoring copy.
 *
 * The answer is to refuse, not to strip: stripping would leave a runner that works, a verdict
 * that is decoration, and nothing on any screen to say the key had been sent (plan 50's finding;
 * plans 53, 54, 66–69 repeat it).
 *
 * The recording is not here: it rides on the audio block, read by the layer. A text source
 * without its text is unanswerable, not leaky.
 */
export function readInformationTransferProjection(value: unknown): StudentProjection | null {
  if (!isRecord(value)) return null;
  if ('expected' in value || 'expectedAnswers' in value) return null;
  if ('grading' in value || 'scoring' in value || 'transcript' in value) return null;
  if (!Array.isArray(value['fields'])) return null;

  const sourceKind = SOURCE_KINDS.find((k) => k === value['sourceKind']);
  if (sourceKind === undefined) return null;

  const form = isRecord(value['form']) ? value['form'] : {};
  const layout = LAYOUTS.find((l) => l === form['layout']) ?? 'form';

  const fields: ProjectedField[] = [];
  for (const entry of value['fields']) {
    if (!isRecord(entry)) return null;
    if ('expected' in entry || 'why' in entry || 'required' in entry || 'focus' in entry) {
      return null;
    }
    const { id, label, type } = entry;
    if (typeof id !== 'string' || id === '') return null;
    if (typeof label !== 'string') return null;
    const fieldType = FIELD_TYPES.find((t) => t === type);
    if (fieldType === undefined) return null;
    const hint = entry['hint'];
    fields.push({
      id,
      label,
      type: fieldType,
      unit: typeof entry['unit'] === 'string' ? entry['unit'] : '',
      placeholder: typeof entry['placeholder'] === 'string' ? entry['placeholder'] : '',
      numeric: entry['numeric'] === true,
      ...(typeof hint === 'string' && hint !== '' ? { hint } : {}),
    });
  }

  const answering = readAnswering(value['answering']);
  if (answering === null) return null;

  let source: { passageTitle?: string; passage?: string } = {};
  if (sourceKind === 'text') {
    const passage = value['passage'];
    if (typeof passage !== 'string' || passage.trim() === '') return null;
    const passageTitle = value['passageTitle'];
    source = {
      passage,
      ...(typeof passageTitle === 'string' && passageTitle !== '' ? { passageTitle } : {}),
    };
  }

  return {
    title: typeof value['title'] === 'string' ? value['title'] : '',
    instruction: typeof value['instruction'] === 'string' ? value['instruction'] : '',
    sourceKind,
    language: typeof value['language'] === 'string' ? value['language'] : '',
    ...source,
    form: { formTitle: typeof form['formTitle'] === 'string' ? form['formTitle'] : '', layout },
    fields,
    answering,
  };
}

/** Field by field rather than spread, so a field the runner has no business with cannot ride in. */
function readAnswering(raw: unknown): StudentProjection['answering'] | null {
  const a = isRecord(raw) ? raw : {};
  if ('passPct' in a) return null;
  const attempts = ATTEMPTS.find((n) => n === a['attempts']);
  return {
    showSource: SHOW_SOURCES.find((s) => s === a['showSource']) ?? 'always',
    oneAtATime: a['oneAtATime'] === true,
    // The server refuses a check past the budget, so a wrong guess here only shows a button it
    // refuses; out of range reads as the author's smallest budget.
    attempts: attempts ?? 1,
    revealKey: REVEAL_KEYS.find((k) => k === a['revealKey']) ?? 'afterLastAttempt',
    hintsAfter: HINTS_AFTER.find((h) => h === a['hintsAfter']) ?? 9,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
