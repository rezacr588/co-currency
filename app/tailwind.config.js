/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Core Colors
        background: "rgb(15, 26, 42)",
        foreground: "rgb(248, 250, 252)",
        card: "rgb(30, 58, 95)",
        "card-foreground": "rgb(248, 250, 252)",

        // Primary - Trust Blue
        primary: {
          DEFAULT: "rgb(30, 58, 95)",
          hover: "rgb(45, 90, 138)",
          foreground: "rgb(255, 255, 255)",
        },

        // Secondary - Slate Neutral
        secondary: {
          DEFAULT: "rgb(51, 65, 85)",
          foreground: "rgb(248, 250, 252)",
        },

        // Accent - Gold Premium
        accent: {
          DEFAULT: "rgb(212, 175, 55)",
          foreground: "rgb(15, 26, 42)",
        },

        // Muted
        muted: {
          DEFAULT: "rgb(51, 65, 85)",
          foreground: "rgb(148, 163, 184)",
        },

        // Finance Semantic Colors
        success: {
          DEFAULT: "rgb(16, 185, 129)",
          light: "rgb(209, 250, 229)",
        },
        danger: {
          DEFAULT: "rgb(220, 38, 38)",
          light: "rgb(254, 226, 226)",
        },
        warning: {
          DEFAULT: "rgb(212, 175, 55)",
          light: "rgb(253, 248, 227)",
        },

        // Border & Input
        border: "rgba(255, 255, 255, 0.1)",
        input: "rgba(255, 255, 255, 0.05)",
        ring: "rgb(212, 175, 55)",
      },
      fontFamily: {
        sans: ["PlusJakartaSans", "system-ui", "sans-serif"],
        mono: ["JetBrainsMono", "monospace"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
      },
    },
  },
  plugins: [],
};
