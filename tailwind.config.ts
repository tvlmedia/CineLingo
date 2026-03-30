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
        background: "#0a0a0b",
        foreground: "#f4f4f6",
        accent: "#c8a66a",
        muted: "#a7abb6",
        card: "#17181b",
        border: "rgba(255, 255, 255, 0.12)"
      },
    },
  },
  plugins: [],
};

export default config;
