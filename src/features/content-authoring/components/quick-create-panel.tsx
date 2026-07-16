'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Plus, Zap, Clipboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { useCreateCourseFlow } from '../hooks/use-create-course-flow';
import { useCreateCourseStore, type LevelSystem, type Starter } from '../stores/create-course';
import { CREATE_COURSE_LANGUAGES } from './create-course-steps/step-basics';

const LEVEL_SYSTEMS: LevelSystem[] = ['cefr', 'custom', 'single'];

const STARTERS: { value: Starter; icon: React.FC<{ className?: string }>; labelKey: string; disabled?: boolean }[] = [
  { value: 'blank', icon: Plus, labelKey: 'starter.blank' },
  { value: 'cefr', icon: Zap, labelKey: 'starter.cefr' },
  { value: 'clone', icon: Clipboard, labelKey: 'starter.clone', disabled: true },
];

function StarterChip({
  selected,
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  selected: boolean;
  icon: React.FC<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-(--ssz-radius-md) border-[1.5px] px-3 py-2 text-sm font-semibold transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-60 border-(--ssz-border-default) text-(--ssz-text-muted)'
          : selected
            ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) text-(--ssz-color-primary-700) dark:bg-(--ssz-color-primary-950)'
            : 'border-(--ssz-border-default) text-(--ssz-text-secondary) hover:bg-subtle',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

/** Single-card "the essentials" alternative to the guided wizard — same create() orchestration. */
export function QuickCreatePanel() {
  const t = useTranslations('Authoring.createCourse');
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const contentBase = `/school/${schoolSlug}/content`;

  const { basics, updateBasics, levelSystem, setLevelSystem, starter, setStarter, reset } =
    useCreateCourseStore();
  const { create, isCreating, canCreate } = useCreateCourseFlow();

  return (
    <div className="mx-auto max-w-xl rounded-(--ssz-radius-lg) border-[1.5px] border-(--ssz-border-default) bg-surface p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-(--ssz-text-primary) font-[Lora]">
          {t('quick.heading')}
        </h2>
        <p className="mt-0.5 text-sm text-(--ssz-text-secondary)">{t('quick.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-4">
        <Field label={t('basics.titleLabel')} htmlFor="quick-create-title" required>
          <Input
            id="quick-create-title"
            placeholder={t('basics.titlePlaceholder')}
            value={basics.title}
            onChange={(e) => updateBasics({ title: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label={t('basics.language')} htmlFor="quick-create-language">
            <Select value={basics.targetLanguage} onValueChange={(v) => updateBasics({ targetLanguage: v })}>
              <SelectTrigger id="quick-create-language" className="w-full">
                <SelectValue placeholder={t('basics.languagePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {CREATE_COURSE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('quick.levelsLabel')} htmlFor="quick-create-levels">
            <Select value={levelSystem} onValueChange={(v) => setLevelSystem(v as LevelSystem)}>
              <SelectTrigger id="quick-create-levels" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_SYSTEMS.map((system) => (
                  <SelectItem key={system} value={system}>
                    {t(`levels.${system}` as Parameters<typeof t>[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label={t('quick.startFrom')} htmlFor="quick-create-starter">
          <div id="quick-create-starter" className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('quick.startFrom')}>
            {STARTERS.map((opt) => (
              <StarterChip
                key={opt.value}
                selected={starter === opt.value}
                icon={opt.icon}
                label={t(opt.labelKey as Parameters<typeof t>[0])}
                disabled={opt.disabled}
                onClick={() => setStarter(opt.value)}
              />
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-(--ssz-border-default) pt-4">
        <Button variant="ghost" asChild>
          <Link href={contentBase} onClick={() => reset()}>
            {t('cancel')}
          </Link>
        </Button>
        <Button onClick={create} disabled={!canCreate || isCreating} loading={isCreating}>
          <Check className="mr-1.5 h-4 w-4" />
          {t('createAndOpen')}
        </Button>
      </div>
    </div>
  );
}
