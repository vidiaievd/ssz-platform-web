import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      /* ────────────────────────────────────────
         NOTE: Colors are defined via CSS custom properties in globals.css.
         Semantic aliases use @theme inline {}; scale palettes (primary-50–900,
         etc.) use @theme {} with direct OKLCH values.
         Tailwind v4 does not support the v3 <alpha-value> placeholder.
      ──────────────────────────────────────── */

      /* ────────────────────────────────────────
         TYPOGRAPHY
      ──────────────────────────────────────── */
      fontFamily: {
        ui:      ['"Plus Jakarta Sans"', '"Segoe UI"', "system-ui", "sans-serif"],
        reading: ["Lora", "Georgia", '"Times New Roman"', "serif"],
        mono:    ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem",  { lineHeight: "1rem"    }],
        xs:    ["0.75rem",   { lineHeight: "1.125rem"}],
        sm:    ["0.875rem",  { lineHeight: "1.375rem"}],
        base:  ["1rem",      { lineHeight: "1.5rem"  }],
        lg:    ["1.125rem",  { lineHeight: "1.75rem" }],
        xl:    ["1.25rem",   { lineHeight: "1.875rem"}],
        "2xl": ["1.5rem",    { lineHeight: "2rem"    }],
        "3xl": ["1.875rem",  { lineHeight: "2.375rem"}],
        "4xl": ["2.25rem",   { lineHeight: "2.75rem" }],
        "5xl": ["3rem",      { lineHeight: "3.5rem"  }],
      },
      lineHeight: {
        tight:   "1.25",
        snug:    "1.375",
        normal:  "1.5",
        relaxed: "1.625",
        loose:   "1.75",  // long-form reading
      },
      letterSpacing: {
        tightest: "-0.03em",
        tight:    "-0.02em",
        normal:    "0em",
        wide:      "0.02em",
        wider:     "0.04em",
        widest:    "0.08em",
      },

      /* ────────────────────────────────────────
         SPACING  (8pt system)
      ──────────────────────────────────────── */
      spacing: {
        "0.5": "2px",
        "1":   "4px",
        "2":   "8px",
        "3":   "12px",
        "4":   "16px",
        "5":   "20px",
        "6":   "24px",
        "8":   "32px",
        "10":  "40px",
        "12":  "48px",
        "16":  "64px",
        "20":  "80px",
        "24":  "96px",
        "32":  "128px",
      },

      /* ────────────────────────────────────────
         BORDER RADIUS
      ──────────────────────────────────────── */
      borderRadius: {
        xs:   "4px",
        sm:   "6px",
        md:   "10px",
        lg:   "16px",
        xl:   "24px",
        "2xl":"32px",
        full: "9999px",
      },

      /* ────────────────────────────────────────
         BOX SHADOW  (warm-toned, subtle)
      ──────────────────────────────────────── */
      boxShadow: {
        xs:  "0 1px 2px oklch(0.18 0.01 80 / 0.06)",
        sm:  "0 1px 4px oklch(0.18 0.01 80 / 0.08), 0 1px 2px oklch(0.18 0.01 80 / 0.06)",
        md:  "0 4px 12px oklch(0.18 0.01 80 / 0.08), 0 2px 4px oklch(0.18 0.01 80 / 0.06)",
        lg:  "0 8px 24px oklch(0.18 0.01 80 / 0.10), 0 4px 8px oklch(0.18 0.01 80 / 0.07)",
        xl:  "0 16px 48px oklch(0.18 0.01 80 / 0.12), 0 8px 16px oklch(0.18 0.01 80 / 0.08)",
        "focus-primary": "0 0 0 3px oklch(0.62 0.105 168 / 0.30)",
        "focus-error":   "0 0 0 3px oklch(0.60 0.125 15  / 0.25)",
      },

      /* ────────────────────────────────────────
         ANIMATION
      ──────────────────────────────────────── */
      transitionDuration: {
        fast:   "100ms",
        base:   "180ms",
        slow:   "280ms",
        slower: "400ms",
      },
      transitionTimingFunction: {
        "ease-snap":   "cubic-bezier(0.16, 1, 0.3, 1)",
        "ease-in-ssz": "cubic-bezier(0.4, 0, 1, 1)",
        "ease-out-ssz":"cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-in":   { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-out":  { from: { opacity: "1" }, to: { opacity: "0" } },
        "slide-in":  { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "progress":  { from: { strokeDashoffset: "var(--circumference)" }, to: { strokeDashoffset: "var(--offset)" } },
      },
      animation: {
        "fade-in":   "fade-in 180ms cubic-bezier(0.16,1,0.3,1)",
        "fade-out":  "fade-out 180ms cubic-bezier(0.16,1,0.3,1)",
        "slide-in":  "slide-in 280ms cubic-bezier(0.16,1,0.3,1)",
        "spin-slow": "spin-slow 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
