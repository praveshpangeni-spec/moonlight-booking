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
        cosmic: {
          bg: "#05060f",
          card: "#0d0f1f",
          border: "#1e2140",
          purple: "#7c3aed",
          "purple-light": "#a78bfa",
          gold: "#f59e0b",
          "gold-light": "#fcd34d",
          silver: "#cbd5e1",
          muted: "#64748b",
        },
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
      backgroundImage: {
        "cosmic-gradient": "radial-gradient(ellipse at top, #1e1040 0%, #05060f 60%)",
        "card-gradient": "linear-gradient(135deg, #0d0f1f 0%, #12153a 100%)",
        "gold-gradient": "linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%)",
        "purple-gradient": "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
      },
      boxShadow: {
        "cosmic": "0 0 40px rgba(124, 58, 237, 0.15)",
        "gold": "0 0 20px rgba(245, 158, 11, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
