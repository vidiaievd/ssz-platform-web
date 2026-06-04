import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  modals: ReactNode;
};

// Parallel route layout: main slot (children) + @modals slot (modals).
// The modals slot renders null by default (default.tsx) and is activated
// when navigating to .../assign-teacher or .../add-students (Phase 5).
export default function GroupDetailLayout({ children, modals }: Props) {
  return (
    <>
      {children}
      {modals}
    </>
  );
}
