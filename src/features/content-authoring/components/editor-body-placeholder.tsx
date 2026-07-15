import { useTranslations } from 'next-intl';

import { getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';

interface EditorBodyPlaceholderProps {
  kind: MaterialKind;
  /** `body` renders inside the main editor column; `preview` inside the phone frame. */
  variant: 'body' | 'preview';
}

/** Interim body/preview content for `LessonEditorShell` until FE2.2–2.6 wire the real per-type editors. */
export function EditorBodyPlaceholder({ kind, variant }: EditorBodyPlaceholderProps) {
  const t = useTranslations('Authoring');
  const def = getLessonTypeDefinition(kind);
  const Icon = def.icon;

  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
      <Icon size={22} style={{ color: `var(${def.hueVar})` }} />
      <p className="text-sm">
        {variant === 'body' ? t('editor.bodyPlaceholder') : t('editor.previewPlaceholder')}
      </p>
    </div>
  );
}
