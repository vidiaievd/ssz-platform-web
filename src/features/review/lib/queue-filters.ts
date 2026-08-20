import {
  REVIEWABLE_EXERCISE_TYPES,
  type ReviewQueueFilters,
  type ReviewableExerciseType,
} from '../types';

/**
 * The view, read out of the address bar.
 *
 * Everything that changes *what is on screen* lives in searchParams and nothing else:
 * a teacher who sends "look at the B1 queue" to a colleague has to send a link that opens
 * the B1 queue, and a reload in the middle of a marking pass must not throw away the
 * filters that made the pass coherent (criterion 6). What is deliberately *not* here is
 * which groups are folded shut — that is a fidget, not a view, and putting it in the URL
 * would make every chevron a history entry.
 *
 * Unknown values fall back rather than erroring. A link carrying `type=made_up` came from
 * a stale bookmark or somebody's typo, and answering it with the unfiltered queue is more
 * useful than answering it with a broken screen.
 */
export const DEFAULT_FILTERS: ReviewQueueFilters = {
  groupBy: 'exercise',
  group: null,
  course: null,
  type: null,
  overdueOnly: false,
};

type ParamSource = Pick<URLSearchParams, 'get'> | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | null {
  if (typeof (source as URLSearchParams).get === 'function') {
    return (source as URLSearchParams).get(key);
  }
  const value = (source as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function parseQueueFilters(source: ParamSource): ReviewQueueFilters {
  const type = read(source, 'type');

  return {
    groupBy: read(source, 'groupBy') === 'student' ? 'student' : 'exercise',
    group: read(source, 'group'),
    course: read(source, 'course'),
    type: REVIEWABLE_EXERCISE_TYPES.includes(type as ReviewableExerciseType)
      ? (type as ReviewableExerciseType)
      : null,
    overdueOnly: read(source, 'overdue') === 'true',
  };
}

/** True when anything is narrowing the queue — what the "nothing here" state turns on. */
export function hasActiveFilters(filters: ReviewQueueFilters): boolean {
  return (
    filters.group !== null ||
    filters.course !== null ||
    filters.type !== null ||
    filters.overdueOnly
  );
}

/**
 * The filters as a query string, with defaults left out.
 *
 * Omitting defaults keeps the address readable and, more usefully, keeps two ways of
 * arriving at the same view from producing two different links — `?groupBy=exercise` and
 * no parameter at all are the same screen and should share a URL.
 *
 * The selected submission rides along because it is part of the view a link reproduces,
 * but it is passed separately: it survives a filter change, and changing a filter must not
 * silently close the submission a teacher is in the middle of reading.
 */
export function queueFiltersToQuery(
  filters: ReviewQueueFilters,
  submission?: string | null,
): string {
  const params = new URLSearchParams();
  if (filters.groupBy !== DEFAULT_FILTERS.groupBy) params.set('groupBy', filters.groupBy);
  if (filters.group) params.set('group', filters.group);
  if (filters.course) params.set('course', filters.course);
  if (filters.type) params.set('type', filters.type);
  if (filters.overdueOnly) params.set('overdue', 'true');
  if (submission) params.set('submission', submission);

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

/**
 * The same filters as the BFF takes them, for the query key and the fetch.
 *
 * The cursor rides along rather than living in the filters: it is a position in one
 * answer, not part of the view, and putting it in the filters would key every page of the
 * queue as a different query.
 */
export function queueFiltersToApiQuery(
  school: string,
  filters: ReviewQueueFilters,
  cursor?: string | null,
): string {
  const params = new URLSearchParams({ school });
  params.set('groupBy', filters.groupBy);
  if (filters.group) params.set('group', filters.group);
  if (filters.course) params.set('course', filters.course);
  if (filters.type) params.set('type', filters.type);
  if (filters.overdueOnly) params.set('overdue', 'true');
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}
