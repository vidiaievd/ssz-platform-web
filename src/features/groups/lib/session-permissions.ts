import type { Session, SessionType } from '../types';

/**
 * What the viewer may change about one session.
 *
 * The same rules are enforced in scheduling-service; they are repeated here so
 * a teacher sees a field they cannot change as disabled, rather than finding out
 * through a 403 after filling it in.
 */
export interface SessionRights {
  /** Topic, attendance and exam marks — the record of what happened. */
  canRecord: boolean;
  /** Date, time, room and status — moving or cancelling the session. */
  canReschedule: boolean;
  canChangeTeacher: boolean;
  /** Only an extra session can be deleted; a planned one is cancelled instead. */
  canDelete: boolean;
}

export interface Viewer {
  /** Owner, admin or manager of the school. */
  canManage: boolean;
  /** The signed-in user, for deciding whether a session is theirs. */
  userId: string | null;
}

const NOTHING: SessionRights = {
  canRecord: false,
  canReschedule: false,
  canChangeTeacher: false,
  canDelete: false,
};

const EVERYTHING: SessionRights = {
  canRecord: true,
  canReschedule: true,
  canChangeTeacher: true,
  canDelete: true,
};

export function sessionRights(viewer: Viewer, session: Session | null): SessionRights {
  if (viewer.canManage) return EVERYTHING;

  // A teacher keeps the record of the sessions they teach, and nothing else.
  // Moving or cancelling one is a request to the school, which has no route
  // yet — so it is refused here rather than half-offered.
  const isOwn = session !== null && session.teacherId !== null && session.teacherId === viewer.userId;
  return isOwn ? { ...NOTHING, canRecord: true } : NOTHING;
}

/**
 * The kinds of extra session the viewer may add. A teacher arranges a make-up
 * for their own group; everything else is the school's call.
 */
export function creatableTypes(viewer: Viewer): SessionType[] {
  return viewer.canManage ? ['lesson', 'exam', 'make_up', 'review'] : ['make_up'];
}
