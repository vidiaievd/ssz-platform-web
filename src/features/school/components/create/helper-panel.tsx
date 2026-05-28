import { useTranslations } from 'next-intl';

export function HelperIllustrationPanel() {
  const t = useTranslations('School');

  return (
    <div
      className="hidden md:flex flex-col gap-6 bg-[var(--ssz-bg-subtle)] border-l border-(--ssz-border-default) p-10 sticky top-0 min-h-full"
      aria-hidden
    >
      {/* Illustration placeholder */}
      <div className="aspect-[4/3] w-full rounded-[var(--ssz-radius-lg)] bg-(--ssz-bg-base) border border-(--ssz-border-default)" />

      <div className="space-y-3">
        <p className="font-semibold text-sm text-(--ssz-text-primary)">
          {t('create.helper.basics.title')}
        </p>
        <ul className="space-y-2">
          {(
            [
              t('create.helper.basics.bullets.0'),
              t('create.helper.basics.bullets.1'),
              t('create.helper.basics.bullets.2'),
            ] as const
          ).map((bullet) => (
            <li key={bullet} className="flex gap-2 text-sm text-(--ssz-text-secondary)">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-(--ssz-color-primary-400)" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
