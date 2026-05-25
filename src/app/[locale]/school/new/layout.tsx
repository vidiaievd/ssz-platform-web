import type { ReactNode } from 'react';

export default function CreateSchoolLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--ssz-bg-base)]">
      {children}
    </div>
  );
}
