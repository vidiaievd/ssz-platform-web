'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

export interface WritingTopic {
  id: string;
  title: string;
}

/**
 * Content schema for writing-task exercises.
 * `topics` when present let the learner choose one prompt to write about.
 * `minWords` is an optional soft target shown in the word counter.
 */
export interface WritingContent {
  prompt: string;
  topics?: WritingTopic[];
  minWords?: number;
  instruction?: string;
}

/** The learner's answer: the essay text plus the chosen topic (if any). */
export interface WritingValue {
  text: string;
  topicId: string | null;
}

export interface WritingBodyProps {
  content: WritingContent;
  value: WritingValue;
  onValueChange: (val: WritingValue) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
}

const READING = 'var(--ssz-font-reading)';

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function WritingBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  mode,
  accent,
}: WritingBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
  const accentSoft = modeAccentSoft(mode);
  const hasTopics = Array.isArray(content.topics) && content.topics.length > 0;
  const words = countWords(value.text);
  const meetsMin = content.minWords === undefined || words >= content.minWords;

  useEffect(() => {
    const topicOk = !hasTopics || value.topicId !== null;
    onAnswerChange(value.text.trim() !== '' && topicOk && meetsMin);
  }, [value.text, value.topicId, hasTopics, meetsMin, onAnswerChange]);

  return (
    <>
      <Instr>{content.instruction ?? t('writing.defaultInstruction')}</Instr>

      <p
        className="mb-4 leading-[1.5]"
        style={{ fontFamily: READING, fontSize: 19, fontWeight: 500, color: 'var(--ssz-text-primary)' }}
      >
        {content.prompt}
      </p>

      {hasTopics && (
        <div className="mb-4 flex flex-col gap-2" role="radiogroup" aria-label={t('writing.topicsLabel')}>
          {(content.topics ?? []).map((topic) => {
            const selected = value.topicId === topic.id;
            return (
              <button
                key={topic.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!isAnswering}
                onClick={() => isAnswering && onValueChange({ ...value, topicId: topic.id })}
                style={{
                  textAlign: 'left',
                  padding: '11px 14px',
                  borderRadius: 11,
                  border: `2px solid ${selected ? accent : 'var(--ssz-border-default)'}`,
                  background: selected ? accentSoft : 'var(--ssz-bg-surface)',
                  color: 'var(--ssz-text-primary)',
                  fontFamily: READING,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isAnswering ? 'pointer' : 'default',
                }}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
              >
                {topic.title}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        value={value.text}
        disabled={!isAnswering}
        aria-label={t('writing.inputLabel')}
        onChange={(e) => onValueChange({ ...value, text: e.target.value })}
        placeholder={t('writing.placeholder')}
        rows={8}
        style={{
          width: '100%',
          fontFamily: READING,
          fontSize: 16,
          color: 'var(--ssz-text-primary)',
          border: '2px solid var(--ssz-border-default)',
          borderRadius: 12,
          background: 'var(--ssz-bg-surface)',
          padding: '12px 14px',
          outline: 'none',
          resize: 'vertical',
        }}
      />

      <p
        className="mt-2 text-right text-[12px]"
        style={{ color: meetsMin ? 'var(--ssz-text-muted)' : 'var(--ssz-feedback-no-fg)' }}
      >
        {content.minWords !== undefined
          ? t('writing.wordCountMin', { count: words, min: content.minWords })
          : t('writing.wordCount', { count: words })}
      </p>
    </>
  );
}
