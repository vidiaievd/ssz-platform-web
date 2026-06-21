'use client';

// Requires backend support — re-point mutation unconfirmed (spec §6.2, Open Q1).
// Do not enable until the org-service endpoint and side-effect contract are confirmed.
// Renders a disabled trigger only; no PATCH { courseId } call exists yet.

import { Button } from '@/components/ui/button';

export function ChangeCourseDialog() {
  return (
    <Button variant="outline" disabled title="Coming soon">
      Change course
    </Button>
  );
}
