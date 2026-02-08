/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Minimal Dark Mode Color System
        // 90% grayscale with minimal accent colors
        // Modern, sophisticated, and clean

        // Background Layers (true blacks and dark grays)
        background: "#09090b",
        "background-secondary": "#0f0f10",
        card: "#141416",
        "card-hover": "#1a1a1d",
        "card-elevated": "#1e1e21",
        "card-foreground": "#fafafa",

        // Foreground / Text (crisp whites and grays)
        foreground: "#fafafa",

        // Primary - White for minimal look (use for main actions)
        primary: {
          DEFAULT: "#fafafa",
          hover: "#e4e4e7",
          muted: "#a1a1aa",
          foreground: "#09090b",
        },

        // Secondary - Subtle dark gray (for secondary actions)
        secondary: {
          DEFAULT: "#27272a",
          hover: "#3f3f46",
          foreground: "#a1a1aa",
        },

        // Accent - Gold (use VERY sparingly - only primary CTAs)
        accent: {
          DEFAULT: "#d4af37",
          hover: "#e5c158",
          muted: "#a68b2c",
          foreground: "#09090b",
        },

        // Muted - For secondary text and subtle backgrounds
        muted: {
          DEFAULT: "#18181b",
          hover: "#27272a",
          foreground: "#71717a",
        },

        // Subtle - Lightest gray for disabled/hints
        subtle: {
          DEFAULT: "#131315",
          foreground: "#52525b",
        },

        // Semantic Colors (use ONLY when meaning is critical)
        success: {
          DEFAULT: "#22c55e",
          muted: "rgba(34, 197, 94, 0.15)",
          foreground: "#22c55e",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "rgba(239, 68, 68, 0.15)",
          foreground: "#ef4444",
        },
        warning: {
          DEFAULT: "#f59e0b",
          muted: "rgba(245, 158, 11, 0.15)",
          foreground: "#f59e0b",
        },

        // Border Colors (subtle, barely visible)
        border: "#27272a",
        "border-subtle": "#1f1f22",
        "border-strong": "#3f3f46",
        input: "#18181b",
        ring: "#52525b",

        // Gray Scale (for explicit use)
        gray: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        },
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
