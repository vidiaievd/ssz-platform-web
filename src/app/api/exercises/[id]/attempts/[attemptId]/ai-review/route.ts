import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { AiReview } from '@/features/student/ai-review/types';

import { refusal } from './refusal';

/**
 * A model's review of the learner's own submission (plan 79, step 2.3).
 *
 * Read as the signed-in learner: the engine answers only for their own attempt, and only
 * once a model's verdict closed it. Everything else — still waiting, a teacher's verdict,
 * nobody to read it — is `NO_AI_REVIEW`, which this route passes on as a plain 404 with the
 * code: the screen has nothing to draw, and that is not a fault to retry.
 *
 * The fields are copied one by one rather than forwarded, so that nothing added upstream —
 * a model id, a prompt version — reaches a learner by inheritance.
 *
 * An essay's marks come by criterion id, and a list of submissions has no rubric to name
 * them by. The attempt holds the rubric as it was frozen at hand-in, so it is read beside
 * the review and each mark leaves here named and in rubric order. Only the names travel:
 * the attempt record also holds the answer and the validator's output.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const { id, attemptId } = await params;

  let review: AiReview;
  try {
    review = await serverFetch<AiReview>({
      service: 'exercises',
      path: `/exercises/${id}/attempts/${attemptId}/ai-review`,
      method: 'GET',
    });
  } catch (e) {
    return refusal(e, 'Failed to load the review');
  }

  const criteria = review.marks?.length ? await rubricOf(id, attemptId) : [];
  const position = new Map(criteria.map((criterion, i) => [criterion.id, i]));

  const body: AiReview = {
    outcome: review.outcome,
    items: (review.items ?? []).map((item) => ({
      itemId: item.itemId,
      sentenceIndex: item.sentenceIndex,
      aspect: item.aspect,
      fragment: item.fragment ?? null,
      comment: item.comment,
      suggestion: item.suggestion ?? null,
    })),
    summary: review.summary ?? null,
    marks:
      review.marks === null || review.marks === undefined
        ? null
        : [...review.marks]
            .sort(
              (a, b) =>
                (position.get(a.criterionId) ?? Infinity) -
                (position.get(b.criterionId) ?? Infinity),
            )
            .map((mark) => ({
              criterionId: mark.criterionId,
              criterionName:
                criteria.find((criterion) => criterion.id === mark.criterionId)?.name ?? null,
              mark: mark.mark,
              reason: mark.reason,
            })),
    reviewedAt: review.reviewedAt,
    disputedAt: review.disputedAt ?? null,
  };
  return NextResponse.json(body);
}

/**
 * The rubric's criteria as frozen on the attempt, or none. A lookup that fails costs the
 * names, never the review.
 */
async function rubricOf(
  exerciseId: string,
  attemptId: string,
): Promise<Array<{ id: string; name: string }>> {
  try {
    const attempt = await serverFetch<{ rubricSnapshot?: unknown }>({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts/${attemptId}`,
      method: 'GET',
    });
    const snapshot = attempt.rubricSnapshot as { criteria?: unknown } | null | undefined;
    if (!Array.isArray(snapshot?.criteria)) return [];
    return snapshot.criteria.flatMap((criterion: unknown) => {
      const { id, name } = (criterion ?? {}) as { id?: unknown; name?: unknown };
      if (typeof id !== 'string') return [];
      return [{ id, name: typeof name === 'string' ? name : '' }];
    });
  } catch {
    return [];
  }
}
