import type { Config } from "tailwindcss";

/**
 * Design system for a government/enterprise document management portal.
 * Palette evokes authority and clarity (deep institutional blue + neutral grays),
 * comparable to Microsoft 365 Admin / SharePoint surfaces.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-arabic)", "Tajawal", "Cairo", "system-ui", "sans-serif"],
      },
      colors: {
        // Institutional brand color (deep authority blue).
        brand: {
          50: "#eef4fb",
          100: "#d5e3f5",
          200: "#adc7ea",
          300: "#7ea6dc",
          400: "#4f83cc",
          500: "#2f66b5",
          600: "#234f93",
          700: "#1c3f76",
          800: "#183460",
          900: "#132a4d",
          950: "#0d1c34",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f5f7fa",
          sunken: "#eef1f6",
        },
        line: {
          DEFAULT: "#e3e8ef",
          strong: "#cbd3df",
        },
        accent: {
          cyan: "#06b6d4",
          "cyan-light": "#22d3ee",
          violet: "#8b5cf6",
          "violet-light": "#a78bfa",
          emerald: "#10b981",
          amber: "#f59e0b",
        },
      },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(135deg, #234f93 0%, #2f66b5 40%, #4f83cc 100%)",
        "gradient-brand-subtle":
          "linear-gradient(135deg, #eef4fb 0%, #f5f7fa 50%, #eef4fb 100%)",
        "gradient-hero":
          "linear-gradient(135deg, #132a4d 0%, #1c3f76 35%, #234f93 70%, #2f66b5 100%)",
        "gradient-mesh":
          "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(47,102,181,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 90% 10%, rgba(6,182,212,0.06) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(139,92,246,0.05) 0%, transparent 50%)",
        "gradient-sidebar":
          "linear-gradient(180deg, #132a4d 0%, #0d1c34 50%, #132a4d 100%)",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16, 24, 40, 0.06), 0 1px 3px 0 rgba(16, 24, 40, 0.10)",
        panel: "0 4px 12px -2px rgba(16, 24, 40, 0.10), 0 2px 6px -2px rgba(16, 24, 40, 0.06)",
        overlay: "0 12px 32px -8px rgba(16, 24, 40, 0.20)",
        glow: "0 0 20px -4px rgba(47, 102, 181, 0.35)",
        "glow-cyan": "0 0 20px -4px rgba(6, 182, 212, 0.35)",
        "glow-violet": "0 0 20px -4px rgba(139, 92, 246, 0.30)",
        "glow-green": "0 0 20px -4px rgba(16, 185, 129, 0.30)",
        "glow-amber": "0 0 20px -4px rgba(245, 158, 11, 0.30)",
        "glow-red": "0 0 20px -4px rgba(239, 68, 68, 0.25)",
        "card-hover":
          "0 8px 24px -4px rgba(47, 102, 181, 0.15), 0 4px 8px -2px rgba(16, 24, 40, 0.08)",
      },
      borderRadius: {
        card: "0.625rem",
      },
      animation: {
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out both",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
