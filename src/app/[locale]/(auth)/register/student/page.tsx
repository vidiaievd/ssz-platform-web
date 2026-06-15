import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';

import { resolveIntent } from '@/lib/enrollment/intent';
import { decodeStudentInvite } from '@/features/enrollment/lib/decode-invite';
import { EnrollmentRegisterForm } from '@/features/enrollment/components/register-form';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterStudentPage({ searchParams }: Props) {
  const t = await getTranslations('Auth.RegisterStudent');
  const params = await searchParams;

  // Build URLSearchParams from the plain object Next.js provides
  const urlParams = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [],
    ),
  );

  const intent = resolveIntent(urlParams);

  // For invite flow: decode the token server-side to lock email
  let prefillEmail: string | undefined;
  let schoolName: string | undefined;

  if (intent.kind === 'invited') {
    try {
      const payload = await decodeStudentInvite(intent.token);
      prefillEmail = payload.email;
      schoolName = payload.schoolName;
    } catch {
      // Token is invalid/expired — fall through to explore (form will show generic view)
    }
  }

  if (intent.kind === 'join_school') {
    // School name will be loaded from settings in Phase 5 (public school page);
    // for now pass the slug as a placeholder
    schoolName = intent.schoolSlug;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      {intent.kind === 'explore' && (
        <ul className="flex flex-col gap-2">
          {(['1', '2', '3'] as const).map((n) => (
            <li key={n} className="flex items-center gap-2 text-sm text-(--ssz-text-secondary)">
              <Check className="size-4 shrink-0 text-(--ssz-text-link)" aria-hidden />
              {t(`valueProp.${n}`)}
            </li>
          ))}
        </ul>
      )}

      <EnrollmentRegisterForm
        intent={intent}
        prefillEmail={prefillEmail}
        schoolName={schoolName}
      />
    </div>
  );
}
