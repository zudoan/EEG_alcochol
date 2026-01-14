/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#050814',
      },
      boxShadow: {
        glow: '0 0 40px rgba(99,102,241,0.35)',
      },
      backdropBlur: {
        glass: '16px',
      },
    },
  },
  plugins: [],
}
