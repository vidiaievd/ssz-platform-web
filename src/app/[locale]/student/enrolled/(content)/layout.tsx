import { getEnrollmentStatus } from '@/features/enrollment/api/get-enrollment-status';
import { EnrollmentRequired } from '@/features/enrollment/components/enrollment-required';

export default async function EnrolledLayout({ children }: { children: React.ReactNode }) {
  const enrollments = await getEnrollmentStatus();

  if (enrollments.length === 0) {
    return <EnrollmentRequired />;
  }

  return <>{children}</>;
}
