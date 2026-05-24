'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Layers, FileText, Copy, X, ChevronRight } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { useCreateWizardStore, type StructureMode } from '../../stores/create-wizard';

// ── Radio card ────────────────────────────────────────────────────────────────

function StructureOptionCard({
  selected,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  value: StructureMode;
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
          ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) dark:bg-(--ssz-color-primary-950)'
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
        <p className="mt-0.5 text-xs text-(--ssz-text-secondary) leading-relaxed">
          {description}
        </p>
      </div>
    </button>
  );
}

// ── Editable level row ────────────────────────────────────────────────────────

function LevelRow({
  index,
  name,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  name: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  function commit() {
    setEditing(false);
    if (draft.trim()) onChange(draft.trim());
    else setDraft(name);
  }

  return (
    <li className="flex items-center gap-2 py-1.5">
      <span className="w-6 shrink-0 text-center text-xs font-mono text-(--ssz-text-muted)">
        {index + 1}
      </span>
      {editing ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="h-7 flex-1 text-sm"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 rounded px-2 py-1 text-left text-sm text-(--ssz-text-primary) hover:bg-subtle transition-colors"
          title="Click to rename"
        >
          {name}
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="shrink-0 rounded p-0.5 text-(--ssz-text-muted) hover:text-destructive transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

// ── Structure preview ─────────────────────────────────────────────────────────

function StructurePreview({ mode, levels }: { mode: StructureMode; levels: string[] }) {
  const t = useTranslations('Authoring');
  const store = useCreateWizardStore();

  if (mode === 'blank') {
    return (
      <div className="rounded-(--ssz-radius-md) border border-dashed border-(--ssz-border-default) p-4 text-center">
        <FileText className="mx-auto mb-2 h-6 w-6 text-(--ssz-text-muted)" aria-hidden />
        <p className="text-sm text-(--ssz-text-secondary)">
          {t('wizard.structure.blankPreview')}
        </p>
      </div>
    );
  }

  if (mode === 'template') {
    return (
      <div className="rounded-(--ssz-radius-md) border border-dashed border-(--ssz-border-default) p-4 text-center">
        <Copy className="mx-auto mb-2 h-6 w-6 text-(--ssz-text-muted)" aria-hidden />
        <p className="text-sm text-(--ssz-text-secondary)">
          {t('wizard.structure.templatePreview')}
        </p>
      </div>
    );
  }

  function updateLevel(index: number, value: string) {
    const next = [...levels];
    next[index] = value;
    store.updateStructure({ cefrLevels: next });
  }

  function removeLevel(index: number) {
    store.updateStructure({ cefrLevels: levels.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-(--ssz-radius-md) border border-(--ssz-border-default) p-4">
      <p className="mb-2 text-xs text-(--ssz-text-muted)">
        {t('wizard.structure.previewAnnotation')}
      </p>
      <ul className="space-y-0.5" role="list">
        {levels.map((level, i) => (
          <LevelRow
            key={`${level}-${i}`}
            index={i}
            name={level}
            onChange={(v) => updateLevel(i, v)}
            onRemove={() => removeLevel(i)}
            canRemove={levels.length > 1}
          />
        ))}
      </ul>
    </div>
  );
}

// ── Step 2: Structure ─────────────────────────────────────────────────────────

export function WizardStepStructure() {
  const t = useTranslations('Authoring');
  const store = useCreateWizardStore();
  const { mode, cefrLevels } = store.structure;

  const options: { value: StructureMode; icon: React.FC<{ className?: string }>; titleKey: string; descKey: string }[] = [
    { value: 'cefr_scaffold', icon: Layers, titleKey: 'wizard.structure.cefr', descKey: 'wizard.structure.cefrHelp' },
    { value: 'blank', icon: FileText, titleKey: 'wizard.structure.blank', descKey: 'wizard.structure.blankHelp' },
    { value: 'template', icon: Copy, titleKey: 'wizard.structure.template', descKey: 'wizard.structure.templateHelp' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary) font-[Lora]">
          {t('wizard.steps.structure')}
        </h1>
        <p className="mt-1 text-sm text-(--ssz-text-secondary)">
          {t('wizard.structure.subtitle')}
        </p>
      </div>

      {/* Radio cards */}
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label={t('wizard.steps.structure')}
      >
        {options.map((opt) => (
          <StructureOptionCard
            key={opt.value}
            value={opt.value}
            selected={mode === opt.value}
            icon={opt.icon}
            title={t(opt.titleKey as Parameters<typeof t>[0])}
            description={t(opt.descKey as Parameters<typeof t>[0])}
            onClick={() => store.updateStructure({ mode: opt.value })}
          />
        ))}
      </div>

      {/* Preview */}
      <div>
        <p className="mb-2 text-sm font-medium text-(--ssz-text-primary)">
          {t('wizard.structure.previewTitle')}
        </p>
        <StructurePreview mode={mode} levels={cefrLevels} />
      </div>
    </div>
  );
}
