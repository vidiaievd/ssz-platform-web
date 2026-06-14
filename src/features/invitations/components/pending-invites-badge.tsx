"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";

import type { InvitationRole } from "../types";

type Props = {
  schoolId: string;
  schoolSlug: string;
  role?: InvitationRole;
};

async function fetchPendingCount(schoolId: string, role?: InvitationRole): Promise<number> {
  const params = new URLSearchParams({ status: "pending" });
  if (role) params.set("role", role);
  const res = await fetch(`/api/schools/${schoolId}/invitations/count?${params.toString()}`);
  if (!res.ok) return 0;
  const data = (await res.json()) as { count: number };
  return data.count;
}

export function PendingInvitesBadge({ schoolId, schoolSlug, role }: Props) {
  const t = useTranslations("Invitations.pendingLink");

  const { data: count = 0 } = useQuery({
    queryKey: ["invitations-count", schoolId, "pending", role],
    queryFn: () => fetchPendingCount(schoolId, role),
    staleTime: 30_000,
  });

  if (count === 0) return null;

  const audience = role === "TEACHER" ? "teachers" : role === "STUDENT" ? "students" : undefined;
  const href = `/school/${schoolSlug}/invitations${audience ? `?audience=${audience}` : ""}`;
  const label = count === 1 ? t("singular") : t("plural", { count });

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
