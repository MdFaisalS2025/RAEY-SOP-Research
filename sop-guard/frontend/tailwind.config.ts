import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Chat-surface type scale (Phase R3). Semantic names, not t-shirt
      // sizes, so a class says what it's for and can be re-tuned in one
      // place. Tailwind's numeric defaults (text-xs/sm/base/lg/xl/...) are
      // deliberately NOT overridden - ~300 arbitrary-px sites elsewhere in
      // the app still rely on them, and silently retuning text-base would
      // move every one. 14px deliberately has no semantic name here - if a
      // future edit reaches for one, that's a signal to reconsider it.
      fontSize: {
        answer: ["1rem", { lineHeight: "1.75" }], // 16 / 28 - answer prose, bullets, steps, KV values
        "answer-h1": ["1.1875rem", { lineHeight: "1.4" }], // 19 / 26.6
        "answer-h2": ["1.0625rem", { lineHeight: "1.45" }], // 17 / 24.6
        "answer-h3": ["1rem", { lineHeight: "1.5" }], // 16 / 24
        chat: ["0.9375rem", { lineHeight: "1.6" }], // 15 / 24 - user bubble, callouts, tables, menu items
        compose: ["1rem", { lineHeight: "1.5" }], // 16 / 24 - composer textarea only (matches text-base's line-height)
        label: ["0.8125rem", { lineHeight: "1.45" }], // 13 / 18.9 - toolbar buttons, KV labels, eyebrows
        meta: ["0.75rem", { lineHeight: "1.5" }], // 12 / 18 - provenance caption, alignment line
        "meta-xs": ["0.6875rem", { lineHeight: "1.45" }], // 11 / 16 - source-list metadata, footnotes
        marker: ["0.625rem", { lineHeight: "1" }], // 10 / 10 - citation superscripts, count badges
        // Bare-string entries below (font-size only, no paired line-height)
        // for the ~300 arbitrary text-[Npx] sites outside the chat surface.
        // Bare strings apply ONLY font-size, exactly like the arbitrary
        // values they replace - unlike Tailwind's numeric scale, they carry
        // no line-height side effect, so this is a zero-visual-delta rename.
        9: "0.5625rem",
        10: "0.625rem",
        11: "0.6875rem",
        12: "0.75rem",
        13: "0.8125rem",
      },
      // --radius is 0.5rem, so these are byte-identical to Tailwind's own
      // defaults (rounded-lg: 0.5rem, rounded-md: 0.375rem) - wiring them
      // to the token is a zero-visual-delta change. Deliberately no `sm`:
      // the shadcn convention (0.25rem) differs from Tailwind's default
      // rounded-sm (0.125rem) and would silently move every such site.
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
      },
      colors: {
        "sop-blue": "#1a365d",
        "sop-teal": "#0d9488",
        "sop-light": "#f0fdfa",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        subtle: "hsl(var(--text-subtle))",
        // Soft tint triples for the tone.ts / badge consolidation (M3-6) -
        // collapse the 7-utility bg-[#FEE2E2] dark:bg-red-500/10 pattern
        // used ~40 times across the app down to bg-danger-soft border-danger-soft-border text-danger-soft-fg.
        danger: { soft: "hsl(var(--danger-soft))", "soft-border": "hsl(var(--danger-soft-border))", "soft-fg": "hsl(var(--danger-soft-fg))" },
        warn: { soft: "hsl(var(--warn-soft))", "soft-border": "hsl(var(--warn-soft-border))", "soft-fg": "hsl(var(--warn-soft-fg))" },
        ok: { soft: "hsl(var(--ok-soft))", "soft-border": "hsl(var(--ok-soft-border))", "soft-fg": "hsl(var(--ok-soft-fg))" },
        "sop-clinical-blue": "#0B6BCB",
        "clinical": {
          cyan: "#0B6BCB",
          blue: "#0B6BCB",
          emerald: "#15803D",
          amber: "#B45309",
          red: "#B91C1C",
          bg: "#F7F9FB",
          surface: "#F1F5F9",
          container: "#FFFFFF",
          text: "#1A2332",
          "text-muted": "#64748B",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        // Drives .text-shimmer in globals.css - a light band travels across
        // the loading phrase text (background-clip:text), Copilot-style.
        shimmer: {
          "0%": { backgroundPosition: "150% 0" },
          "100%": { backgroundPosition: "-50% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.2s ease-in",
        "slide-up": "slide-up 0.4s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
}

export default config
