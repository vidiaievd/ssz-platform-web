import type { SrsCardSentence } from '../../types';

interface SampleSentenceProps {
  sentence: SrsCardSentence;
}

export function SampleSentence({ sentence }: SampleSentenceProps) {
  return (
    <div className="space-y-0.5">
      <p
        className="font-[var(--ssz-font-reading)] text-base text-[var(--ssz-text-primary)]"
        lang="und"
      >
        {sentence.target}
      </p>
      <p className="text-sm text-[var(--ssz-text-secondary)]">{sentence.translation}</p>
    </div>
  );
}
