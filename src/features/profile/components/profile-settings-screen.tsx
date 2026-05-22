import { useTranslations } from 'next-intl';

import { ProfileCompleteness } from './profile-completeness';
import { ProfileForm } from './profile-form';
import { AvatarUploader } from './avatar-uploader';

export function ProfileSettingsScreen() {
  const t = useTranslations('Profile');

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-[var(--ssz-text-muted)] mt-1">{t('subtitle')}</p>
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
    </div>
  );
}
