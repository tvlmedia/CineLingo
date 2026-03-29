import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b1020",
        foreground: "#f8fafc",
        accent: "#7c3aed",
        muted: "#94a3b8",
        card: "#111827",
        border: "#1f2937"
      },
    },
  },
  plugins: [],
};

export default config;
