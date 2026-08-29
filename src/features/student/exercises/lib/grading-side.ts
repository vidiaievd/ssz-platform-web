import { isMultipleChoiceDocument } from '@/lib/shared-kernel/multiple-choice';
import { isMultipleChoiceGroupDocument } from '@/lib/shared-kernel/multiple-choice-group';
import { isShortAnswerDocument } from '@/lib/shared-kernel/short-answer';

/**
 * Which templates are graded in the browser, and therefore need the answer key there.
 *
 * The reader used to fetch every exercise from the authoring route, key and all, and
 * decide afterwards what to do with it — including for the six templates whose grading
 * moved to the server precisely because their key is the exercise. The key travelled
 * anyway; the runner simply did not read it, which is not the same thing as it not
 * being sent.
 *
 * So the decision moves to where it can actually withhold something: the BFF asks for
 * the student projection first and only reaches for the key when the browser is the
 * thing that grades. This list is what it asks with, and `exercise-page.tsx` holds the
 * matching runners — a test keeps the two from drifting apart.
 */
export const CLIENT_GRADED_TEMPLATES = [
  'multiple_choice',
  'multiple_choice_group',
  'fill_in_blank',
  'short_answer',
  'word_bank_fill',
  'text_order',
] as const;

export type ClientGradedTemplate = (typeof CLIENT_GRADED_TEMPLATES)[number];

/**
 * Whether this particular document is graded in the browser.
 *
 * The template code alone answers it for ten of the thirteen. Three are exceptions and
 * have to be: one code covers two live document shapes, and the shapes are graded on
 * opposite sides.
 *
 * `short_answer` (plan 51 §8 Q1): the old single-question form is checked here against a
 * list of accepted strings and needs them; the new set of open questions is graded on the
 * server, and its key is a set of phrasings of the answer itself.
 *
 * `multiple_choice` (plan 53 §3.2): the old single-question form has always been checked
 * in the browser against a list of option ids, and 121 seeded exercises are still written
 * that way. The new set is graded on the server — not because an option id is a secret,
 * but because the second try and the 50/50 are dosing, and a browser holding the key has
 * nothing left to dose.
 *
 * `multiple_choice_group` (plan 54 §3.2): the old form of a question list keeps its key in
 * `expected_answers` and is checked here; the new table is graded on the server, where the
 * retry budget, the freeze on correct rows and the moment the key becomes visible all live.
 * Every one of those is dosing, and a browser holding the key doses nothing.
 */
export function gradedInBrowser(templateCode: string, content: unknown): boolean {
  if (!(CLIENT_GRADED_TEMPLATES as readonly string[]).includes(templateCode)) return false;
  if (templateCode === 'short_answer') return !isShortAnswerDocument(content);
  if (templateCode === 'multiple_choice') return !isMultipleChoiceDocument(content);
  if (templateCode === 'multiple_choice_group') return !isMultipleChoiceGroupDocument(content);
  return true;
}
