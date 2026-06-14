"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Link, useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { InvitePreview, InvitationRole } from "@/features/invitations/types";
import type { CurrentUser } from "@/features/auth/types/current-user";
import { acceptInvitation } from "@/features/invitations/api/mutations";

function inviteRoleToAuthRole(role: InvitationRole): 'school_admin' | 'teacher' | 'tutor' | 'student' {
  if (role === 'TEACHER') return 'teacher';
  if (role === 'STUDENT') return 'student';
  return 'school_admin';
}

type Props = {
  token: string;
  preview: InvitePreview;
  currentUser: CurrentUser | null;
  locale: string;
};

function resolveWorkspacePath(preview: InvitePreview, locale: string): string {
  if (preview.role === "STUDENT" || !preview.schoolSlug) {
    return `/${locale}/student`;
  }
  return `/${locale}/school/${preview.schoolSlug}`;
}

export function InviteCard({ token, preview, currentUser, locale }: Props) {
  const t = useTranslations("Invite");
  const tRoles = useTranslations("Invitations.roles");
  const formatter = useFormatter();
  const router = useRouter();

  const [now] = useState<number>(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const [liveMessage, setLiveMessage] = useState("");
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  const workspacePath = resolveWorkspacePath(preview, locale);
  const { expiresDate, expiringSoon } = useMemo(() => {
    const expires = new Date(preview.expiresAt);
    const days = (expires.getTime() - now) / (1000 * 60 * 60 * 24);
    return { expiresDate: expires, expiringSoon: days <= 2 };
  }, [preview.expiresAt, now]);

  const formattedExpiry = formatter.dateTime(expiresDate, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Email mismatch: current user's email from JWT doesn't match invite email.
  const hasEmailMismatch =
    currentUser?.email != null &&
    currentUser.email.toLowerCase() !== preview.email.toLowerCase();

  function handleAccept() {
    setLiveMessage(t("accept.syncing"));
    startTransition(async () => {
      const result = await acceptInvitation(token);
      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          router.replace(`/login?redirect=/invite/${token}`);
          return;
        }
        if (result.reason === "terminal") {
          setLiveMessage(t("accept.error"));
          // Hard-reload to re-render page in terminal state via RSC.
          router.refresh();
          return;
        }
        setLiveMessage(t("accept.error"));
        toast.error(t("accept.error"));
        return;
      }
      const message = result.alreadyMember
        ? t("accept.alreadyMember")
        : t("accept.success", { schoolName: preview.schoolName });
      setLiveMessage(message);
      toast.success(message);
      router.replace(workspacePath);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1
          ref={h1Ref}
          tabIndex={-1}
          className="text-2xl font-semibold text-(--ssz-text-primary) outline-none"
        >
          {t("title.invited", { schoolName: preview.schoolName })}
        </h1>
        <p className="text-sm text-(--ssz-text-muted)">
          {t("title.role", { role: tRoles(preview.role) })}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface px-5 py-4 flex flex-col gap-3">
        {preview.invitedByName && (
          <p className="text-sm text-(--ssz-text-secondary)">
            {t("meta.invitedBy", { name: preview.invitedByName })}
          </p>
        )}
        <p className="text-sm text-(--ssz-text-secondary)">
          {t("meta.forEmail", { email: preview.email })}{" "}
          <span className="font-mono text-(--ssz-text-primary)">
            {preview.email}
          </span>
        </p>
        <p
          className={`text-sm ${expiringSoon ? "font-medium text-amber-600 dark:text-amber-400" : "text-(--ssz-text-muted)"}`}
        >
          {t("meta.expiresAt", { date: formattedExpiry })}
        </p>
      </div>

      {/* Email mismatch warning */}
      {hasEmailMismatch && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950"
        >
          <AlertTriangle
            className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t("mismatch.title")}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t("mismatch.body", {
                inviteEmail: preview.email,
                currentEmail: currentUser!.email!,
              })}
            </p>
          </div>
        </div>
      )}

      {/* Live region for accept status */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-2">
        {!currentUser ? (
          <>
            {preview.kind === "register" ? (
              <>
                <Button asChild className="w-full">
                  <Link
                    href={`/register?invite=${token}&email=${encodeURIComponent(preview.email)}&role=${inviteRoleToAuthRole(preview.role)}`}
                  >
                    {t("cta.createAccount")}
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href={`/login?redirect=/invite/${token}`}>
                    {t("cta.haveAccount")}
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild className="w-full">
                <Link href={`/login?redirect=/invite/${token}`}>
                  {t("cta.signInToAccept")}
                </Link>
              </Button>
            )}
          </>
        ) : hasEmailMismatch ? (
          <>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/login?redirect=/invite/${token}`}>
                {t("cta.signInAsInvitee", { email: preview.email })}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href={`/login?redirect=/invite/${token}`}>
                {t("cta.notYou")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleAccept}
              disabled={isPending}
              loading={isPending}
              aria-busy={isPending}
              className="w-full"
            >
              {isPending ? t("accept.syncing") : t("cta.accept")}
            </Button>
            {currentUser && (
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">{t("cta.notYou")}</Link>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
