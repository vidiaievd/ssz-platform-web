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
         COLORS — mapped from CSS variables
         Use: bg-primary, text-primary-foreground,
              bg-secondary, text-muted, etc.
      ──────────────────────────────────────── */
      colors: {
        /* shadcn-compatible semantic aliases */
        background:  "oklch(var(--ssz-bg-base-ch) / <alpha-value>)",
        foreground:  "oklch(var(--ssz-text-primary-ch) / <alpha-value>)",
        border:      "oklch(var(--ssz-border-default-ch) / <alpha-value>)",
        input:       "oklch(var(--ssz-border-default-ch) / <alpha-value>)",
        ring:        "oklch(var(--ssz-primary-ch) / <alpha-value>)",

        primary: {
          DEFAULT:    "oklch(var(--ssz-primary-ch) / <alpha-value>)",
          foreground: "oklch(1 0 0 / <alpha-value>)",
          50:  "oklch(0.97 0.025 168 / <alpha-value>)",
          100: "oklch(0.93 0.05  168 / <alpha-value>)",
          200: "oklch(0.87 0.075 168 / <alpha-value>)",
          300: "oklch(0.79 0.09  168 / <alpha-value>)",
          400: "oklch(0.70 0.10  168 / <alpha-value>)",
          500: "oklch(0.62 0.105 168 / <alpha-value>)",
          600: "oklch(0.54 0.10  168 / <alpha-value>)",
          700: "oklch(0.44 0.09  168 / <alpha-value>)",
          800: "oklch(0.34 0.07  168 / <alpha-value>)",
          900: "oklch(0.24 0.05  168 / <alpha-value>)",
        },

        secondary: {
          DEFAULT:    "oklch(var(--ssz-secondary-ch) / <alpha-value>)",
          foreground: "oklch(1 0 0 / <alpha-value>)",
          50:  "oklch(0.98 0.02  82 / <alpha-value>)",
          100: "oklch(0.95 0.045 82 / <alpha-value>)",
          200: "oklch(0.90 0.07  82 / <alpha-value>)",
          300: "oklch(0.83 0.09  82 / <alpha-value>)",
          400: "oklch(0.75 0.105 82 / <alpha-value>)",
          500: "oklch(0.67 0.11  82 / <alpha-value>)",
          600: "oklch(0.57 0.105 82 / <alpha-value>)",
          700: "oklch(0.46 0.09  82 / <alpha-value>)",
          800: "oklch(0.35 0.07  82 / <alpha-value>)",
          900: "oklch(0.24 0.045 82 / <alpha-value>)",
        },

        neutral: {
          0:   "oklch(1.00  0.005 80 / <alpha-value>)",
          50:  "oklch(0.975 0.007 80 / <alpha-value>)",
          100: "oklch(0.95  0.010 80 / <alpha-value>)",
          200: "oklch(0.90  0.010 80 / <alpha-value>)",
          300: "oklch(0.83  0.010 80 / <alpha-value>)",
          400: "oklch(0.70  0.010 80 / <alpha-value>)",
          500: "oklch(0.58  0.010 80 / <alpha-value>)",
          600: "oklch(0.46  0.010 80 / <alpha-value>)",
          700: "oklch(0.36  0.010 80 / <alpha-value>)",
          800: "oklch(0.26  0.010 80 / <alpha-value>)",
          900: "oklch(0.18  0.010 80 / <alpha-value>)",
        },

        success: {
          DEFAULT: "oklch(0.60 0.13 145 / <alpha-value>)",
          50:  "oklch(0.96 0.04  145 / <alpha-value>)",
          100: "oklch(0.90 0.07  145 / <alpha-value>)",
          300: "oklch(0.76 0.11  145 / <alpha-value>)",
          500: "oklch(0.60 0.13  145 / <alpha-value>)",
          700: "oklch(0.44 0.11  145 / <alpha-value>)",
        },
        warning: {
          DEFAULT: "oklch(0.66 0.13 75 / <alpha-value>)",
          50:  "oklch(0.97 0.03  75 / <alpha-value>)",
          100: "oklch(0.92 0.065 75 / <alpha-value>)",
          300: "oklch(0.80 0.11  75 / <alpha-value>)",
          500: "oklch(0.66 0.13  75 / <alpha-value>)",
          700: "oklch(0.48 0.11  75 / <alpha-value>)",
        },
        error: {
          DEFAULT: "oklch(0.60 0.125 15 / <alpha-value>)",
          50:  "oklch(0.97 0.025 15 / <alpha-value>)",
          100: "oklch(0.92 0.055 15 / <alpha-value>)",
          300: "oklch(0.78 0.10  15 / <alpha-value>)",
          500: "oklch(0.60 0.125 15 / <alpha-value>)",
          700: "oklch(0.44 0.105 15 / <alpha-value>)",
        },
        info: {
          DEFAULT: "oklch(0.60 0.12 235 / <alpha-value>)",
          50:  "oklch(0.96 0.03  235 / <alpha-value>)",
          100: "oklch(0.91 0.055 235 / <alpha-value>)",
          300: "oklch(0.76 0.10  235 / <alpha-value>)",
          500: "oklch(0.60 0.12  235 / <alpha-value>)",
          700: "oklch(0.44 0.10  235 / <alpha-value>)",
        },

        /* Semantic surface / text aliases → theme-aware via CSS vars */
        surface:  "var(--ssz-bg-surface)",
        subtle:   "var(--ssz-bg-subtle)",
        muted: {
          DEFAULT:    "var(--ssz-bg-muted)",
          foreground: "var(--ssz-text-muted)",
        },
      },

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
