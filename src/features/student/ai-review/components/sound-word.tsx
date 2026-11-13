const READING = 'var(--ssz-font-reading)';

/**
 * A word a sound remark is about and, where its sounds were named, how it should sound in IPA
 * (plan 88, step 5c). The same line on the learner's review and on the teacher's card.
 */
export function SoundWord({ word, transcription }: { word: string; transcription: string | null }) {
  return (
    <p className="text-[13.5px] leading-relaxed">
      <span
        className="rounded bg-warning-100 px-1 dark:bg-warning-500/20"
        style={{ fontFamily: READING }}
      >
        {word}
      </span>
      {transcription !== null && (
        <span className="ml-1.5 text-(--ssz-text-secondary)">/{transcription}/</span>
      )}
    </p>
  );
}
