/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Classic Banking Navy Blue
        primary: {
          50: '#f0f5fa',
          100: '#dce8f3',
          200: '#b9d1e8',
          300: '#8bb3d5',
          400: '#5a8fc0',
          500: '#3a6fa6',
          600: '#2d5a8a',
          700: '#264a70',
          800: '#1e3a5f',
          900: '#0f2942',
          950: '#081a2b',
        },
        // Classic Gold Accent
        accent: {
          50: '#fefdf7',
          100: '#fdf8e3',
          200: '#faefc1',
          300: '#f5e18f',
          400: '#efd05c',
          500: '#d4af37',
          600: '#b8960f',
          700: '#9a7b0c',
          800: '#7d6410',
          900: '#664f13',
          950: '#3b2c07',
        },
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
