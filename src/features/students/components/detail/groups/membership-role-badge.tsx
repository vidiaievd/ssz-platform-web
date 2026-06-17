import { cn } from "@/lib/utils";
import type { MembershipRole } from "@/features/students/types";

const ROLE_META: Record<
  MembershipRole,
  { label: string; className: string }
> = {
  student: {
    label: "Student",
    className: "bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)",
  },
  trial: {
    label: "Trial",
    className: "bg-info-100 text-info-700",
  },
  observer: {
    label: "Observer",
    className: "bg-(--ssz-bg-muted) text-(--ssz-text-tertiary)",
  },
};

type Props = {
  role: MembershipRole;
  className?: string;
  /** Override label (for i18n) */
  label?: string;
};

export function MembershipRoleBadge({ role, className, label }: Props) {
  const meta = ROLE_META[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      {label ?? meta.label}
    </span>
  );
}
