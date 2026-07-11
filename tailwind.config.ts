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
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16, 24, 40, 0.06), 0 1px 3px 0 rgba(16, 24, 40, 0.10)",
        panel: "0 4px 12px -2px rgba(16, 24, 40, 0.10), 0 2px 6px -2px rgba(16, 24, 40, 0.06)",
        overlay: "0 12px 32px -8px rgba(16, 24, 40, 0.20)",
      },
      borderRadius: {
        card: "0.625rem",
      },
    },
  },
  plugins: [],
};

export default config;
