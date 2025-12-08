/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'polygon': {
          'primary': '#00ff88',
          'secondary': '#0088ff',
          'danger': '#ff4444',
          'warning': '#ffaa00',
          'dark': '#0a0a0f',
          'darker': '#050508',
        }
      },
      fontFamily: {
        'game': ['Orbitron', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
