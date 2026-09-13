import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { ProgressDashboard, WhereYouStand, WorthALook } from '@/features/student/progress';

/**
 * The learner's own progress screen — plan 58, screen F.
 *
 * Two blocks above the course list, and both are allowed to be absent. What is worth a
 * look this week comes from the learner's own profile; where they stand comes from their
 * group, in words, and only if their school shows it at all. Neither renders a
 * placeholder: a card that says "nothing to report" every day teaches a student to stop
 * reading the screen.
 */
export default async function StudentProgressPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user?.userId && (
        <div className="mx-auto flex max-w-205 flex-col gap-3 px-4.5 pt-5.5 sm:px-8.5 sm:pt-7.5">
          <WorthALook userId={user.userId} />
          <WhereYouStand userId={user.userId} />
        </div>
      )}
      <ProgressDashboard />
    </>
  );
}
