import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:   "#E85068",
        "primary-hover": "#C73D55",
        surface:   "#111111",
        "surface-2": "#1A1A1A",
        border:    "#2A2A2A",
        muted:     "#6B6B6B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        dome: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
