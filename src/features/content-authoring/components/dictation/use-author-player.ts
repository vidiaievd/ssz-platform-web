'use client';

import { useMemo } from 'react';

import { useExerciseAudio, type ExerciseAudioEngine } from '@/features/student/exercises/audio';
import { hasClip, type ExerciseAudio } from '@/lib/shared-kernel/audio';

/**
 * The author's player: the student's engine with every limit lifted (plan 68 §7.4, the
 * prototype's `plays: 0, seek, speed`), and a silent clip of the stored length while no
 * file is attached (decision Q7-A) so *Set start here* works before the recording exists.
 *
 * `simulated` is for the label — the engine itself does not know its clip is a stand-in.
 */
export function useAuthorPlayer(audio: ExerciseAudio): {
  eng: ExerciseAudioEngine;
  simulated: boolean;
} {
  const content = useMemo(
    () => ({
      audio: {
        ...audio,
        enabled: true,
        settings: { ...audio.settings, plays: 0, seek: true, speed: true, gate: 'none' as const },
      },
    }),
    [audio],
  );
  const eng = useExerciseAudio(content, { simulate: true });
  return { eng, simulated: !hasClip(audio) && audio.duration > 0 };
}
