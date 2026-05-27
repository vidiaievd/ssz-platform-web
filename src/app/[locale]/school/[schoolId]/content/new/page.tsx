import { Suspense } from 'react';

import { CreateWizard } from '@/features/content-authoring';

export default function NewContainerPage() {
  return (
    // Suspense required because CreateWizard reads useSearchParams()
    <Suspense>
      <CreateWizard />
    </Suspense>
  );
}
