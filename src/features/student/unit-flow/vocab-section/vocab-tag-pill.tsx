'use client';

const TAG_BG: Record<string, string> = {
  noun: 'oklch(0.94 0.04 245)',
  verb: 'oklch(0.94 0.04 145)',
  adj:  'oklch(0.95 0.04 82)',
};

const TAG_FG: Record<string, string> = {
  noun: 'oklch(0.42 0.13 245)',
  verb: 'oklch(0.44 0.11 145)',
  adj:  'oklch(0.46 0.09 82)',
};

export function VocabTagPill({ pos }: { pos: string }) {
  const key = pos === 'adj' ? 'adj' : pos === 'verb' ? 'verb' : 'noun';
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-[0.03em]"
      style={{
        background: TAG_BG[key] ?? 'var(--ssz-bg-subtle)',
        color: TAG_FG[key] ?? 'var(--ssz-text-muted)',
      }}
    >
      {pos}
    </span>
  );
}
