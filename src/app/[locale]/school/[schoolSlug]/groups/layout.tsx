import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

// The AppShell is already provided by the parent [schoolSlug]/layout.tsx.
// This layout exists to mark the active nav segment and provide a scoped
// container for the groups section. Intercepted modals (@modals) slot in here.
export default function GroupsLayout({ children }: Props) {
  return <>{children}</>;
}
