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
        surge: {
          bg: "#080810",
          surface: "#0f0f1a",
          card: "#111120",
          border: "#1c1c30",
          green: "#22c55e",
          "green-muted": "#16a34a",
          "green-glow": "#4ade80",
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
