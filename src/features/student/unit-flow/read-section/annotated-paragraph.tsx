'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { GlossaryPopover } from '@/features/learning';
import type { PartOfSpeech } from '@/features/learning';
import { cn } from '@/lib/utils';

import type { GlossaryEntry, GlossaryMap, ListenMode } from './read-section-types';

interface Token {
  text: string;
  glossaryKey: string | null;
  id: number;
}

function tokenize(text: string, glossary: GlossaryMap): Token[] {
  const keys = Object.keys(glossary).sort((a, b) => b.length - a.length);
  if (keys.length === 0) return [{ text, glossaryKey: null, id: 0 }];
  const esc = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re  = new RegExp(`(${esc.join('|')})`, 'gi');
  return text.split(re).map((part, i) => ({
    text: part,
    glossaryKey: keys.find((k) => k.toLowerCase() === part.toLowerCase()) ?? null,
    id: i,
  }));
}

export interface AnnotatedParagraphProps {
  /** Norwegian target text. */
  target: string;
  /** English translation (shown when showTranslation=true). */
  translation: string;
  glossary: GlossaryMap;
  isActive: boolean;
  listenMode: ListenMode;
  showTranslation: boolean;
  onParaClick?: () => void;
}

export function AnnotatedParagraph({
  target,
  translation,
  glossary,
  isActive,
  listenMode,
  showTranslation,
  onParaClick,
}: AnnotatedParagraphProps) {
  const t = useTranslations('Learning.readSection');
  const tokens = useMemo(() => tokenize(target, glossary), [target, glossary]);
  const canClick = listenMode === 'listen-text';

  return (
    <div
      onClick={canClick ? onParaClick : undefined}
      title={canClick ? t('jumpAudio') : undefined}
      className={cn(
        'rounded-[10px] border-l-[3px] px-3 py-2 -mx-3',
        'transition-[background,border-color]',
        canClick && 'cursor-pointer',
      )}
      style={{
        borderColor: isActive ? 'var(--ssz-color-primary-500)' : 'transparent',
        background: isActive ? 'oklch(0.62 0.105 168 / 7%)' : 'transparent',
        transitionDuration: 'var(--ssz-duration-slow)',
      }}
    >
      <p
        className="m-0 font-reading text-[18px] text-(--ssz-text-primary)"
        style={{ lineHeight: 1.88, textWrap: 'pretty' } as React.CSSProperties}
        lang="nb"
      >
        {tokens.map((token) => {
          if (!token.glossaryKey) {
            return (
              <span
                key={token.id}
                style={{
                  background: isActive ? 'oklch(0.62 0.105 168 / 14%)' : 'transparent',
                  borderRadius: 3,
                  transition: `background ${String('var(--ssz-duration-slow)')}`,
                }}
              >
                {token.text}
              </span>
            );
          }

          const entry: GlossaryEntry = glossary[token.glossaryKey]!;

          return (
            <GlossaryPopover
              key={token.id}
              word={token.text}
              pos={entry.tag as PartOfSpeech}
              translation={entry.tr}
              phonetic={entry.ph}
              contextSentence={target}
            >
              <span
                role="button"
                tabIndex={0}
                aria-label={`${t('lookUpWord')}: ${token.text}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'cursor-pointer rounded-[3px] px-px',
                  'underline decoration-dotted decoration-2 underline-offset-[3px]',
                  'transition-[background,text-decoration-color]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
                )}
                style={{
                  textDecorationColor: 'oklch(0.62 0.105 168 / 70%)',
                  background: isActive ? 'oklch(0.62 0.105 168 / 14%)' : 'transparent',
                  transitionDuration: 'var(--ssz-duration-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'oklch(0.62 0.105 168 / 18%)';
                  e.currentTarget.style.textDecorationColor = 'var(--ssz-color-primary-500)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive ? 'oklch(0.62 0.105 168 / 14%)' : 'transparent';
                  e.currentTarget.style.textDecorationColor = 'oklch(0.62 0.105 168 / 70%)';
                }}
              >
                {token.text}
              </span>
            </GlossaryPopover>
          );
        })}
      </p>

      {showTranslation && (
        <p
          className="m-0 mt-2 font-reading text-[13.5px] italic text-(--ssz-text-muted)"
          style={{
            lineHeight: 1.7,
            borderLeft: '2px solid oklch(0.62 0.105 168 / 40%)',
            paddingLeft: 12,
          }}
        >
          {translation}
        </p>
      )}
    </div>
  );
}
