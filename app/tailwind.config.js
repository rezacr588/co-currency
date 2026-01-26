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
        // Core Colors (Dark Mode - Default)
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
          foreground: "rgb(255, 255, 255)",
        },
        danger: {
          DEFAULT: "rgb(220, 38, 38)",
          light: "rgb(254, 226, 226)",
          foreground: "rgb(255, 255, 255)",
        },
        warning: {
          DEFAULT: "rgb(212, 175, 55)",
          light: "rgb(253, 248, 227)",
          foreground: "rgb(15, 26, 42)",
        },

        // Border & Input
        border: "rgba(255, 255, 255, 0.1)",
        input: "rgba(255, 255, 255, 0.05)",
        ring: "rgb(212, 175, 55)",
      },
      fontFamily: {
        // Base font family - Inter Regular (400)
        sans: ["Inter_400Regular", "system-ui", "sans-serif"],
        // Medium weight (500) - use with font-medium class
        "sans-medium": ["Inter_500Medium", "system-ui", "sans-serif"],
        // Semibold weight (600) - use with font-semibold class
        "sans-semibold": ["Inter_600SemiBold", "system-ui", "sans-serif"],
        // Bold weight (700) - use with font-bold class
        "sans-bold": ["Inter_700Bold", "system-ui", "sans-serif"],
        // Monospace for numbers and code
        mono: ["monospace"],
      },
      // Font weight mappings to use specific Inter weights
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      // Consistent spacing scale
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      // Consistent border radius
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.375rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      // Font sizes with proper line heights for readability
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },
    },
  },
  plugins: [],
};
