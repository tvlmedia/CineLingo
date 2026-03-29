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
        background: "#050b1d",
        foreground: "#f8fafc",
        accent: "#18d3a3",
        muted: "#a9b8d8",
        card: "rgba(8, 20, 43, 0.72)",
        border: "rgba(124, 146, 186, 0.22)"
      },
    },
  },
  plugins: [],
};

export default config;
