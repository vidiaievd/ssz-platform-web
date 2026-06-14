import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  count: number;
  href: string;
};

export function PendingInvitesLink({ count, href }: Props) {
  const t = useTranslations('Invitations.pendingLink');

  if (count === 0) return null;

  const label = count === 1 ? t('singular') : t('plural', { count });

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
    >
      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
