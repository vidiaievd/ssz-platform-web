import { useTranslations } from 'next-intl';

import type { WizardStep } from '../../stores/create-wizard-store';

type HelperIllustrationPanelProps = {
  step: WizardStep;
};

export function HelperIllustrationPanel({ step }: HelperIllustrationPanelProps) {
  const t = useTranslations('School');

  if (step === 'done') return null;

  return (
    <div
      className="hidden md:flex flex-col gap-6 bg-[var(--ssz-bg-subtle)] border-l border-(--ssz-border-default) p-10 sticky top-0 min-h-full"
      aria-hidden
    >
      {/* Illustration placeholder */}
      <div className="aspect-[4/3] w-full rounded-[var(--ssz-radius-lg)] bg-(--ssz-bg-base) border border-(--ssz-border-default)" />

      {step === 'basics' && (
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
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ssz-color-primary-400)]" />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'invite' && (
        <div className="space-y-3">
          <p className="font-semibold text-sm text-(--ssz-text-primary)">
            {t('create.helper.invite.title')}
          </p>
          <p className="text-sm text-(--ssz-text-secondary) leading-[1.6]">
            {t('create.helper.invite.body')}
          </p>
        </div>
      )}
    </div>
  );
}
