import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SchoolIllustration } from './school-illustration';

const BULLET_KEYS = ['0', '1', '2', '3', '4'] as const;

export function HelperIllustrationPanel() {
  const t = useTranslations('School.create.helper');

  const bulletList = (
    <ul className="space-y-2.5">
      {BULLET_KEYS.map((k) => (
        <li key={k} className="flex items-start gap-2.5 text-sm text-(--ssz-text-secondary)">
          <Check
            className="mt-0.5 size-4 shrink-0 text-(--ssz-text-link)"
            aria-hidden
          />
          {t(`bullets.${k}`)}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop aside — visible md+ */}
      <aside
        className="hidden md:flex flex-col gap-6 bg-subtle border-l border-(--ssz-border-default) p-10 sticky top-0 min-h-full"
        aria-label={t('title')}
      >
        <div className="space-y-4">
          <p className="font-semibold text-sm text-(--ssz-text-primary)">{t('title')}</p>
          {bulletList}
          <p className="text-xs text-(--ssz-text-muted) leading-relaxed pt-1">
            {t('reassurance')}
          </p>
        </div>

        <SchoolIllustration className="w-full max-w-40 mx-auto opacity-80" />
      </aside>

      {/* Mobile disclosure — visible below md */}
      <details className="md:hidden border-t border-(--ssz-border-default) group">
        <summary className="flex cursor-pointer items-center justify-between px-6 py-3 text-sm font-medium text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) transition-colors list-none">
          {t('mobileTrigger')}
          <svg
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
            viewBox="0 0 16 16" fill="none" aria-hidden
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="px-6 pb-4 space-y-2.5">
          {bulletList}
        </div>
      </details>
    </>
  );
}
