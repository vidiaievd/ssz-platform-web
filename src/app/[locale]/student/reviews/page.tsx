import { Bell } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { EmptyState } from '@/features/learning/components/empty-state';

/** Placeholder — replaced with the full Reviews & reminders screen in a later step of the Home redesign. */
export default async function StudentReviewsPage() {
  const t = await getTranslations('Student');

  return (
    <div className="px-8 py-8 max-w-275 mx-auto">
      <EmptyState
        icon={Bell}
        title={t('comingSoon.title')}
        description={t('comingSoon.description')}
      />
    </div>
  );
}
