'use client';

import { useTranslations } from 'next-intl';
import { Globe, Lock, EyeOff, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useCreateWizardStore, type VisibilityMode } from '../../stores/create-wizard';

// ── Radio card ────────────────────────────────────────────────────────────────

function VisibilityCard({
  selected,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  value: VisibilityMode;
  selected: boolean;
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-2 rounded-(--ssz-radius-lg) border-2 p-5 text-left transition-colors duration-(--ssz-duration-base)',
        'hover:bg-subtle',
        selected
          ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) dark:bg-[oklch(0.15_0.02_168)]'
          : 'border-(--ssz-border-default) bg-surface',
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-(--ssz-color-primary-600) text-white">
          <ChevronRight className="h-3 w-3" aria-hidden />
        </span>
      )}
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-(--ssz-radius-md)',
          selected
            ? 'bg-(--ssz-color-primary-100) text-(--ssz-color-primary-700)'
            : 'bg-subtle text-(--ssz-text-secondary)',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-semibold text-sm text-(--ssz-text-primary)">{title}</p>
        <p className="mt-0.5 text-xs text-(--ssz-text-secondary) leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

// ── Step 4: Visibility ────────────────────────────────────────────────────────

export function WizardStepVisibility() {
  const t = useTranslations('Authoring');
  const store = useCreateWizardStore();
  const { mode } = store.visibility;

  const options: {
    value: VisibilityMode;
    icon: React.FC<{ className?: string }>;
    titleKey: string;
    descKey: string;
  }[] = [
    {
      value: 'invite_only',
      icon: Lock,
      titleKey: 'wizard.visibility.inviteOnly',
      descKey: 'wizard.visibility.inviteOnlyHelp',
    },
    {
      value: 'public_catalog',
      icon: Globe,
      titleKey: 'wizard.visibility.publicCatalog',
      descKey: 'wizard.visibility.publicCatalogHelp',
    },
    {
      value: 'internal_draft',
      icon: EyeOff,
      titleKey: 'wizard.visibility.internalDraft',
      descKey: 'wizard.visibility.internalDraftHelp',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary) font-[Lora]">
          {t('wizard.steps.visibility')}
        </h1>
        <p className="mt-1 text-sm text-(--ssz-text-secondary)">
          {t('wizard.visibility.subtitle')}
        </p>
      </div>

      {/* Radio cards */}
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label={t('wizard.steps.visibility')}
      >
        {options.map((opt) => (
          <VisibilityCard
            key={opt.value}
            value={opt.value}
            selected={mode === opt.value}
            icon={opt.icon}
            title={t(opt.titleKey as Parameters<typeof t>[0])}
            description={t(opt.descKey as Parameters<typeof t>[0])}
            onClick={() => store.updateVisibility({ mode: opt.value })}
          />
        ))}
      </div>

      {/* Info note */}
      <p className="text-xs text-(--ssz-text-muted) rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-subtle px-4 py-3">
        {t('wizard.visibility.note')}
      </p>
    </div>
  );
}
