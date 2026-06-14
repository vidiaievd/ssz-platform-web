'use client';

import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { ProfileCompleteness } from './profile-completeness';
import { ProfileForm } from './profile-form';
import { AvatarUploader } from './avatar-uploader';
import { TeachingProfileSection } from './teaching-profile-section';
import { StudentProfileSection } from './student-profile-section';
import { useMyProfile } from '../api/use-my-profile';

type Props = {
  /** True only for private tutors — shows hourly rate fields in the teaching section */
  isPrivateTutor?: boolean;
  /** True for school teachers — shows teaching profile section without tutor-only fields */
  isTeacher?: boolean;
};

export function ProfileSettingsScreen({ isPrivateTutor = false, isTeacher = false }: Props) {
  const t = useTranslations('Profile');
  const { data: profile, isLoading } = useMyProfile();

  const showTeaching = isPrivateTutor || isTeacher || profile?.hasTutorProfile;
  const showStudent = profile?.hasStudentProfile;

  return (
    <div className="p-6 md:p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <ProfileCompleteness />

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('sections.avatar')}</h2>
        <AvatarUploader />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('sections.info')}</h2>
        <ProfileForm />
      </section>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-10 w-full max-w-xl" />
        </div>
      )}

      {!isLoading && showTeaching && (
        <TeachingProfileSection showRate={isPrivateTutor} />
      )}

      {!isLoading && showStudent && (
        <StudentProfileSection />
      )}
    </div>
  );
}
