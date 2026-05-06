/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'charcoal': '#121212',
        'safety-orange': '#FF5F1F',
        'hyper-lime': '#CCFF00',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(255, 95, 31, 0.5)' },
          '100%': { boxShadow: '0 0 40px rgba(255, 95, 31, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
