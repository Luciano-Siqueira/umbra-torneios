/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base dark
        bg: {
          DEFAULT: "#0a0a0a",
          panel: "#141414",
          card: "#1a1a1a",
          cardalt: "#222222",
        },
        fg: {
          DEFAULT: "#f5f5f5",
          dim: "#8a8a8a",
          muted: "#6b6b6b",
        },
        // Cores MTG WUBRG
        mtg: {
          white: "#f9f5e3",
          blue: "#5b9bd5",
          black: "#2b2432",
          red: "#e15b5b",
          green: "#7bc47f",
          colorless: "#c9c5c0",
        },
        acento: "#c9a648",
        sucesso: "#7bc47f",
        atencao: "#fbbf24",
        perigo: "#e15b5b",
        info: "#5b9bd5",
        pos: {
          1: "#fbbf24", // ouro
          2: "#d1d5db", // prata
          3: "#d08a5b", // bronze
          4: "#6b7280", // grafite
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["Consolas", "Menlo", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "fadeIn": "fadeIn 0.3s ease-out",
        "slideUp": "slideUp 0.4s ease-out",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
