import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Avatar ──────────────────────────────────────
   Shows initials when no image src is provided.
─────────────────────────────────────────────── */
interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Full name — used to derive initials */
  name?: string;
  /** Image URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Override the initials background color (CSS color string) */
  color?: string;
}

const sizeMap = {
  sm: { outer: "size-7",  text: "text-xs"  },
  md: { outer: "size-9",  text: "text-sm"  },
  lg: { outer: "size-11", text: "text-base"},
  xl: { outer: "size-14", text: "text-lg"  },
};

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, src, alt, size = "md", color, ...props }, ref) => {
    const { outer, text } = sizeMap[size];
    /* The brand-hue emphasis tier, not the 500: initials are small bold text on
       a near-white tint, where the 500 lands at 3.45:1. This one is also
       theme-aware, which the literal it replaced was not. */
    const bg = color ?? "var(--ssz-text-accent)";
    /* color-mix, not a hex alpha suffix: `${bg}22` silently produces an invalid
       value for every caller that passes an oklch() string — which is all of
       them — so the tint and the border never rendered at all. */
    const tint = (pct: number) => `color-mix(in oklch, ${bg} ${pct}%, transparent)`;

    return (
      <div
        ref={ref}
        className={cn(
          "relative shrink-0 rounded-full overflow-hidden",
          "flex items-center justify-center font-bold",
          "border-[1.5px]",
          outer,
          text,
          className
        )}
        style={{
          background: src ? "transparent" : tint(13),
          color: bg,
          borderColor: tint(27),
        }}
        aria-label={alt ?? name}
        role="img"
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic user-uploaded URL; domain not known at build time
          <img src={src} alt={alt ?? name} className="w-full h-full object-cover" />
        ) : (
          getInitials(name)
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
