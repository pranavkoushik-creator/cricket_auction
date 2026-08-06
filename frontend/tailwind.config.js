/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cricket: {
          dark: '#0B0F19',
          card: '#151C2C',
          border: '#2A354D',
          gold: '#FFB800',
          green: '#10B981',
          accent: '#3B82F6',
          danger: '#EF4444'
        }
      }
    },
  },
  plugins: [],
}

