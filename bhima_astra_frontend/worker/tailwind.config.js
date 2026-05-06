/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../landingPage/bhima-astra/src/**/*.{js,ts,jsx,tsx}",
    "../manager/**/*.{js,ts,jsx,tsx}",
    "../admin/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Landing page custom colors
        charcoal: "#121212",
        "safety-orange": "#FF5F1F",
        "hyper-lime": "#CCFF00",
      },
      fontFamily: {
        // Worker design system fonts
        heading: ["Cormorant Garamond", "serif"],
        body: ["DM Mono", "monospace"],
        // Manager design system fonts (also used by landing page)
        display: ["Cormorant Garamond", "serif"],
        mono: ["DM Mono", "monospace"],
      },
      animation: {
        // Landing page animations
        float: "float 6s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite alternate",
        "spin-slow": "spin-slow 8s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(255, 95, 31, 0.5)" },
          "100%": { boxShadow: "0 0 40px rgba(255, 95, 31, 0.8)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};
