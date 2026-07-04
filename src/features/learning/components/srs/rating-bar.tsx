"use client";

import { Check, Minus, RefreshCw, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { ReviewRating, SrsCard } from "../../types";

interface RatingConfig {
  rating: ReviewRating;
  labelKey: "again" | "hard" | "good" | "easy";
  ariaKey: "ariaAgain" | "ariaHard" | "ariaGood" | "ariaEasy";
  icon: React.ReactNode;
  classes: string;
}

const RATINGS: RatingConfig[] = [
  {
    rating: 1,
    labelKey: "again",
    ariaKey: "ariaAgain",
    icon: <RefreshCw className="h-4 w-4" aria-hidden />,
    classes:
      "bg-[var(--ssz-color-error-50)] text-[var(--ssz-color-error-700)] border-[var(--ssz-color-error-300)] hover:bg-[var(--ssz-color-error-100)]",
  },
  {
    rating: 2,
    labelKey: "hard",
    ariaKey: "ariaHard",
    icon: <Minus className="h-4 w-4" aria-hidden />,
    classes:
      "bg-[var(--ssz-color-warning-50)] text-[var(--ssz-color-warning-700)] border-[var(--ssz-color-warning-300)] hover:bg-[var(--ssz-color-warning-100)]",
  },
  {
    rating: 3,
    labelKey: "good",
    ariaKey: "ariaGood",
    icon: <Check className="h-4 w-4" aria-hidden />,
    classes:
      "bg-[var(--ssz-color-primary-50)] text-[var(--ssz-color-primary-700)] border-[var(--ssz-color-primary-300)] hover:bg-[var(--ssz-color-primary-100)]",
  },
  {
    rating: 4,
    labelKey: "easy",
    ariaKey: "ariaEasy",
    icon: <Star className="h-4 w-4" aria-hidden />,
    classes:
      "bg-[var(--ssz-color-success-50)] text-[var(--ssz-color-success-700)] border-[var(--ssz-color-success-300)] hover:bg-[var(--ssz-color-success-100)]",
  },
];

interface RatingBarProps {
  card: SrsCard;
  disabled?: boolean;
  onRate: (rating: ReviewRating) => void;
  /** Ref to the "Good" button so focus can land there on reveal. */
  goodButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function RatingBar({
  card,
  disabled,
  onRate,
  goodButtonRef,
}: RatingBarProps) {
  const t = useTranslations("Srs.rating");

  return (
    <div
      className="sticky bottom-0 border-t border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-busy={disabled}
    >
      <div className="mx-auto grid max-w-[40rem] grid-cols-2 gap-2.5 p-3 sm:grid-cols-4">
        {RATINGS.map(({ rating, labelKey, ariaKey, icon, classes }) => {
          const interval =
            card.predicted[String(rating) as "1" | "2" | "3" | "4"].label;
          return (
            <button
              key={rating}
              ref={rating === 3 ? goodButtonRef : undefined}
              onClick={() => !disabled && onRate(rating)}
              disabled={disabled}
              aria-label={t(ariaKey, { interval })}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-[var(--ssz-radius-md)] border px-3 py-2.5 transition-colors focus-visible:shadow-[var(--ssz-focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                classes,
              )}
            >
              <span className="font-mono text-[10px] text-[var(--ssz-text-muted)]">
                {rating}
              </span>
              <span className="text-xs font-medium text-[var(--ssz-text-muted)]">
                {t("intervalIn", { label: interval })}
              </span>
              <span className="flex items-center gap-1 text-sm font-bold">
                {icon}
                {t(labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
