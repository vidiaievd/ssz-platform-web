'use client';

import { useTranslations } from 'next-intl';

import type { AudioIssue } from '@/lib/shared-kernel/audio';

/**
 * The message for one audio issue, in the teacher's language — plan 56 §3.11.
 *
 * The same division as every type's `issue-copy`: the kernel says what is wrong and names
 * the parameters, this says it in words. Written once for all thirteen templates, because
 * the issue list is one list.
 */
export function useAudioIssueCopy(): (issue: AudioIssue) => string {
  const t = useTranslations('Authoring');

  return (issue: AudioIssue) => {
    switch (issue.code) {
      case 'AUD_NO_CLIP':
        return t('audio.issues.noClip');
      case 'AUD_NO_TITLE':
        return t('audio.issues.noTitle');
      case 'AUD_NO_TRANSCRIPT':
        return t('audio.issues.noTranscript');
      case 'AUD_ONE_PLAY_MANY_ITEMS':
        return t('audio.issues.onePlayManyItems', { items: issue.items });
      case 'AUD_LIMIT_WITH_SEEK':
        return t('audio.issues.limitWithSeek');
      case 'AUD_SEG_INVERTED':
        return t('audio.issues.segInverted');
      case 'AUD_SEG_BEYOND':
        return t('audio.issues.segBeyond');
    }
  };
}
