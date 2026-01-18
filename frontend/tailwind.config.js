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
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-slower': 'float 10s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'bounce-once': 'bounce-once 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(5deg)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'bounce-once': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
