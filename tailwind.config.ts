import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark navy palette — Sleeper-inspired
        navy: {
          950: "#090d18",
          900: "#0d1525",
          850: "#101a2b",
          800: "#111e32",
          750: "#152233",
          700: "#1a2d47",
          600: "#233a5c",
          500: "#2d4a73",
        },
      },
      animation: {
        "spin-slow": "spin 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
