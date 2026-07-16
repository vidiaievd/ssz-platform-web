'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Layers, Zap, ChevronRight } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import { Link } from '@/lib/i18n/navigation';

import { useCreateCourseStore, type CreateCourseFlow } from '../stores/create-course';
import { CreateCourseWizard } from './create-course-wizard';
import { QuickCreatePanel } from './quick-create-panel';

/** `/school/:slug/content/new` — flow toggle (Guided wizard | Quick create) over the shared create-course store. */
export function CreateCoursePage() {
  const t = useTranslations('Authoring');
  const tCreate = useTranslations('Authoring.createCourse');
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const searchParams = useSearchParams();
  const { flow, setFlow } = useCreateCourseStore();

  // `?flow=quick` lets other entry points (e.g. the course-list empty state) land directly on quick-create.
  useEffect(() => {
    const param = searchParams.get('flow');
    if (param === 'quick' || param === 'wizard') setFlow(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex items-center gap-1.5 text-sm text-(--ssz-text-muted)"
      >
        <Link
          href={`/school/${schoolSlug}/content`}
          className="hover:text-(--ssz-text-secondary) hover:underline"
        >
          {t('breadcrumb.courses')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-(--ssz-text-secondary)">{tCreate('breadcrumb')}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-(--ssz-text-primary) font-[Lora]">
          {tCreate('title')}
        </h1>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-(--ssz-text-muted)">{tCreate('flowLabel')}</span>
          <Segmented
            size="sm"
            value={flow}
            onValueChange={(v: CreateCourseFlow) => setFlow(v)}
            aria-label={tCreate('flowLabel')}
            options={[
              { value: 'wizard', icon: Layers, label: tCreate('flowWizard') },
              { value: 'quick', icon: Zap, label: tCreate('flowQuick') },
            ]}
          />
        </div>
      </div>

      {flow === 'wizard' ? <CreateCourseWizard /> : <QuickCreatePanel />}
    </div>
  );
}
