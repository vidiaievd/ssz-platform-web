import { getTranslations } from "next-intl/server";

import { Link } from "@/lib/i18n/navigation";

import { verifyEmailConfirmAction } from "../actions/verify-email";

type VerifyEmailStatusProps = {
  token: string;
};

export async function VerifyEmailStatus({ token }: VerifyEmailStatusProps) {
  const t = await getTranslations("Auth.VerifyEmail");

  const result = await verifyEmailConfirmAction(token);

  if (result.ok) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-(--ssz-text-primary)">
          {t("successTitle")}
        </p>
        <p className="text-sm text-(--ssz-text-muted)">
          {t("successDescription")}
        </p>
        <Link
          href="/login"
          className="text-sm text-(--ssz-text-link) hover:underline"
        >
          {t("signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="font-semibold text-error">{t("errorTitle")}</p>
      <p className="text-sm text-(--ssz-text-muted)">{t("errorDescription")}</p>
      <Link
        href="/login"
        className="text-sm text-(--ssz-text-link) hover:underline"
      >
        {t("signIn")}
      </Link>
    </div>
  );
}
