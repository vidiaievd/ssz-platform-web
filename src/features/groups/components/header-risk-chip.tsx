import { AlertChip } from '@/components/shared/operations';
import type { Alert } from '@/features/dashboard/types';

type Props = {
  alerts: Alert[];
};

/**
 * Surfaces the single highest-severity alert beside the group name.
 * The full list stays in GroupResolveBanner — no +N overflow here (spec Q4).
 */
export function HeaderRiskChip({ alerts }: Props) {
  if (alerts.length === 0) return null;

  const highest =
    alerts.find((a) => a.severity === 'danger') ?? alerts.find((a) => a.severity === 'warn');
  if (!highest) return null;

  return <AlertChip alert={highest} />;
}
