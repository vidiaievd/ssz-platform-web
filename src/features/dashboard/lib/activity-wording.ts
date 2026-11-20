/**
 * analytics stores each activity row's verb in English (`what`) beside the event behind it
 * (`eventType`). The dashboard words it in the reader's language from the event, and keeps the
 * stored English only for an event it does not know.
 */
export type ActivityWording =
  | { key: 'joined'; role: string }
  | { key: 'published' | 'enrolled' | 'submitted' }
  | { key: 'reviewed'; outcome: string }
  | { key: null; raw: string };

const AFTER = (text: string, marker: string) => {
  const at = text.indexOf(marker);
  return at < 0 ? '' : text.slice(at + marker.length).trim().toLowerCase();
};

export function activityWording(eventType: string | undefined, what: string): ActivityWording {
  switch (eventType) {
    case 'school.member.added':
      // "joined as teacher": the role is the only part the event adds.
      return { key: 'joined', role: AFTER(what, 'joined as ') };
    case 'content.container.published':
      return { key: 'published' };
    case 'learning.enrollment.created':
      return { key: 'enrolled' };
    case 'exercise.attempt.routed_for_review':
      return { key: 'submitted' };
    case 'exercise.attempt.reviewed':
      // "reviewed submission — passed"
      return { key: 'reviewed', outcome: AFTER(what, '— ') };
    default:
      return { key: null, raw: what };
  }
}
