"use client";

import { Check, Minus, RefreshCw, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { ReviewRating, SrsCard } from "../../types";

interface RatingConfig {
  rating: ReviewRating;
  /** Keyboard shortcut, and the FSRS grade number the rating maps to. */
  shortcut: 1 | 2 | 3 | 4;
  labelKey: "again" | "hard" | "good" | "easy";
  ariaKey: "ariaAgain" | "ariaHard" | "ariaGood" | "ariaEasy";
  icon: React.ReactNode;
  classes: string;
}

const RATINGS: RatingConfig[] = [
  {
    rating: "AGAIN",
    shortcut: 1,
    labelKey: "again",
    ariaKey: "ariaAgain",
    icon: <RefreshCw className="h-4 w-4" aria-hidden />,
    classes:
      "bg-[var(--ssz-color-error-50)] text-[var(--ssz-color-error-700)] border-[var(--ssz-color-error-300)] hover:bg-[var(--ssz-color-error-100)]",
  },
  {
    rating: "HARD",
    shortcut: 2,
    labelKey: "hard",
    ariaKey: "ariaHard",
    icon: <Minus className="h-4 w-4" aria-hidden />,
    classes:
      "bg-[var(--ssz-color-warning-50)] text-[var(--ssz-color-warning-700)] border-[var(--ssz-color-warning-300)] hover:bg-[var(--ssz-color-warning-100)]",
  },
  {
    rating: "GOOD",
    shortcut: 3,
    labelKey: "good",
    ariaKey: "ariaGood",
    icon: <Check className="h-4 w-4" aria-hidden />,
    classes:
      "bg-[var(--ssz-color-primary-50)] text-[var(--ssz-color-primary-700)] border-[var(--ssz-color-primary-300)] hover:bg-[var(--ssz-color-primary-100)]",
  },
  {
    rating: "EASY",
    shortcut: 4,
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

  // `predicted` is an array keyed by rating, and it is empty on any card that
  // did not come from `/srs/due` — the interval line is then omitted.
  const intervals = new Map(card.predicted.map((p) => [p.rating, p.label]));

  return (
    <div
      className="sticky bottom-0 border-t border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-busy={disabled}
    >
      <div className="mx-auto grid max-w-[40rem] grid-cols-2 gap-2.5 p-3 sm:grid-cols-4">
        {RATINGS.map(({ rating, shortcut, labelKey, ariaKey, icon, classes }) => {
          const interval = intervals.get(rating);
          return (
            <button
              key={rating}
              ref={rating === "GOOD" ? goodButtonRef : undefined}
              onClick={() => !disabled && onRate(rating)}
              disabled={disabled}
              aria-label={interval ? t(ariaKey, { interval }) : t(labelKey)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-[var(--ssz-radius-md)] border px-3 py-2.5 transition-colors focus-visible:shadow-[var(--ssz-focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                classes,
              )}
            >
              <span className="font-mono text-[10px] text-[var(--ssz-text-muted)]">
                {shortcut}
              </span>
              {interval && (
                <span className="text-xs font-medium text-[var(--ssz-text-muted)]">
                  {t("intervalIn", { label: interval })}
                </span>
              )}
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

/** Keyboard shortcuts 1-4 → FSRS grades, in the order the buttons are shown. */
export const RATING_BY_SHORTCUT: Record<number, ReviewRating> = {
  1: "AGAIN",
  2: "HARD",
  3: "GOOD",
  4: "EASY",
};
