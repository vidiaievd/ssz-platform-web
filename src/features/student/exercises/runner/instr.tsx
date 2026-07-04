'use client';

/** Uppercase 11px/700 muted instruction eyebrow — precedes every exercise body. */
export function Instr({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.07em]"
      style={{ color: 'var(--ssz-text-muted)', letterSpacing: '0.07em' }}
    >
      {children}
    </div>
  );
}
