import { LayoutList, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type CourseView = 'units' | 'skills';

export interface ViewToggleProps {
  value: CourseView;
  onChange: (view: CourseView) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const t = useTranslations('Learning.courseHome.viewToggle');

  return (
    <div
      role="tablist"
      aria-label={`${t('units')} / ${t('skills')}`}
      className="inline-flex rounded-[11px] p-1"
      style={{ background: 'var(--ssz-bg-subtle)' }}
    >
      {(['units', 'skills'] as const).map((view) => {
        const active = value === view;
        const Icon = view === 'units' ? LayoutList : Layers;
        return (
          <button
            key={view}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-[160ms]"
            style={{
              background: active ? 'var(--ssz-bg-surface)' : 'transparent',
              color: active ? 'var(--ssz-text-primary)' : 'var(--ssz-text-muted)',
              boxShadow: active ? 'var(--ssz-shadow-xs)' : 'none',
            }}
          >
            <Icon size={15} aria-hidden="true" />
            {t(view)}
          </button>
        );
      })}
    </div>
  );
}
