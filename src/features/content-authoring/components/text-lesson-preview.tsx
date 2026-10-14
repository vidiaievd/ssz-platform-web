import { useTranslations } from 'next-intl';

import { LessonProse, type GlossaryIndex } from '@/features/learning';
import { isShownOutsideProse } from '@/lib/content/lesson-media-tokens';

import { splitParagraphs } from '../lib/split-paragraphs';

interface TextLessonPreviewProps {
  title: string;
  body: string;
  glossary: GlossaryIndex;
  lang?: string;
}

/** Live "exactly what the learner sees" preview for a TEXT lesson, rendered inside `PhoneFrame`. */
export function TextLessonPreview({ title, body, glossary, lang }: TextLessonPreviewProps) {
  const t = useTranslations('Authoring');
  // Drawn as the reader draws it: dialogue, quotes, lists, tables and images, not raw markup.
  const paragraphs = splitParagraphs(body).filter((p, i) => !isShownOutsideProse(p, i));

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
      </div>
      <div className="px-4 py-3.5 font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)">
        {paragraphs.length === 0 ? (
          <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
        ) : (
          paragraphs.map((p, i) => (
            <LessonProse key={i} text={p} glossary={glossary} lang={lang} className="mb-3" />
          ))
        )}
      </div>
    </div>
  );
}
