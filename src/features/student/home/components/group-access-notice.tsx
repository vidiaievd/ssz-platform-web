import { GraduationCap } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { StudentSchool } from '@/features/student/types';
import { Link } from '@/lib/i18n/navigation';

export interface GroupAccessNoticeProps {
  schools: StudentSchool[];
}

/**
 * Tells the student, in plain terms, that a school group has given them course
 * materials — the fact they most need on first arrival and the one the course
 * cards alone do not spell out. Renders nothing when no group carries material.
 */
export async function GroupAccessNotice({ schools }: GroupAccessNoticeProps) {
  const t = await getTranslations('Student.home.groupAccess');

  // Deliberately not gated on the membership status: a school can place a
  // student in a group while their application row still reads `onboarding`,
  // and that placement is what grants the materials.
  const withMaterials = schools.filter(
    (s) => s.groupId && (s.mainCourse || s.materials.length > 0),
  );
  if (!withMaterials.length) return null;

  return (
    <ul className="flex flex-col gap-2.5">
      {withMaterials.map((school) => {
        // Link straight at the course: the My-courses screen is still a
        // placeholder, and a notice that promises materials must not dead-end.
        const courseId = (school.mainCourse ?? school.materials[0])!.courseId;
        return (
          <li
            key={school.membershipId}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border-[1.5px] border-[oklch(0.88_0.05_235)] bg-[oklch(0.97_0.02_235)] px-4 py-3 dark:border-[oklch(0.38_0.06_235)] dark:bg-[oklch(0.26_0.03_235)]"
          >
            <GraduationCap
              size={18}
              className="shrink-0 text-(--ssz-color-info-700)"
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1 text-[13.5px] text-(--ssz-text-primary)">
              {t('message', {
                group: school.groupName ?? '',
                school: school.schoolName,
              })}
            </p>
            <Link
              href={`/student/courses/${courseId}`}
              className="text-[13px] font-bold text-(--ssz-color-info-700) underline-offset-2 hover:underline"
            >
              {t('cta')}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
