'use client';

import { useSearchParams, useRouter } from 'next/navigation';

import { PlacementFullscreenShell } from '@/features/student/placement/placement-fullscreen-shell';

export default function PlacementPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const targetLanguage = searchParams.get('lang') ?? 'nb';

  function handleModuleSelect() {
    // Placement page has no specific course context yet; return to student home.
    // When wired into the course enrollment flow, pass a courseId via searchParams
    // and navigate to the correct module route.
    router.push('/student');
  }

  return (
    <PlacementFullscreenShell
      targetLanguage={targetLanguage}
      onModuleSelect={handleModuleSelect}
    />
  );
}
