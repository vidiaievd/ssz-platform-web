import { useTranslations } from 'next-intl';

import { getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';

interface EditorBodyPlaceholderProps {
  kind: MaterialKind;
}

/** Interim preview content for `LessonEditorShell` until FE2.6 wires the real live-stub editor. */
export function EditorBodyPlaceholder({ kind }: EditorBodyPlaceholderProps) {
  const t = useTranslations('Authoring');
  const def = getLessonTypeDefinition(kind);
  const Icon = def.icon;

  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
      <Icon size={22} style={{ color: `var(${def.hueVar})` }} />
      <p className="text-sm">{t('editor.previewPlaceholder')}</p>
    </div>
  );
}
