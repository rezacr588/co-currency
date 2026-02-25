# CoFinance Application - Complete Documentation

> **Legacy Note (2026-02-25)**: Sections that reference `frontend/` describe the removed legacy web client. Active client implementation is now Expo React Native under `app/`.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Structure](#component-structure)
4. [Features](#features)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Styling & Theming](#styling--theming)
8. [File Structure](#file-structure)
9. [Key Implementation Details](#key-implementation-details)
10. [Data Flow](#data-flow)

---

## Overview

**CoFinance** (cofinance) is a modern, real-time CoFinance web application that provides exchange rates for 160+ currencies worldwide. The application is built with React, TypeScript, and Tailwind CSS, featuring a clean, responsive interface with dark mode support.

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query (@tanstack/react-query)
- **Build Tool**: Vite
- **Backend API**: Frankfurter API (real-time exchange rates)
- **PWA**: Service Worker with Workbox
- **Routing**: React Router DOM
- **SEO**: React Helmet Async

### Repository
- **GitHub**: rezacr588/cofinance
- **Branch Pattern**: `claude/<feature-name>-<sessionId>`
- **Main Branch**: (not specified, uses default)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Client                           │
├─────────────────────────────────────────────────────────────┤
│  React App (SPA)                                            │
│  ├── Router (React Router)                                  │
│  ├── Context Providers (Theme, Language)                    │
│  ├── React Query (Data Fetching & Caching)                  │
│  └── Pages/Components                                       │
├─────────────────────────────────────────────────────────────┤
│  API Layer (React Query Hooks)                              │
│  ├── useConvert (debounced, 150ms)                         │
│  ├── useCurrencies (cached 1 hour)                         │
│  ├── useRates (real-time rates)                            │
│  └── useHistorical (historical data)                        │
├─────────────────────────────────────────────────────────────┤
│  External API: Frankfurter                                  │
│  └── https://api.frankfurter.app                           │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
cofinance/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── features/       # Feature-specific components
│   │   │   │   ├── Converter/  # CoFinance components
│   │   │   │   ├── ExchangeRates/
│   │   │   │   ├── HistoricalRates/
│   │   │   │   └── QuickConversions/
│   │   │   ├── layout/         # Layout components
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Header.tsx
│   │   │   └── ui/             # Reusable UI components
│   │   ├── context/            # React Context providers
│   │   │   ├── LanguageContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useConvert.ts
│   │   │   ├── useCurrencies.ts
│   │   │   ├── useDebounce.ts
│   │   │   ├── useHistorical.ts
│   │   │   └── useRates.ts
│   │   ├── pages/              # Page components
│   │   │   ├── About.tsx
│   │   │   ├── Currencies.tsx
│   │   │   ├── Home.tsx
│   │   │   └── Rates.tsx
│   │   ├── types/              # TypeScript type definitions
│   │   │   └── currency.ts
│   │   ├── utils/              # Utility functions
│   │   │   ├── constants.ts    # Currency flags, symbols
│   │   │   └── format.ts       # Number/rate formatting
│   │   ├── i18n/               # Internationalization
│   │   │   └── translations.ts # EN, FA, AR, ES, FR, DE, JA
│   │   ├── App.tsx             # Main app component
│   │   ├── main.tsx            # Entry point
│   │   └── index.css           # Global styles
│   ├── public/                 # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── backend/                     # (If exists - not documented here)
```

---

## Component Structure

### 1. Converter Component (Main CoFinance)

**Location**: `/frontend/src/components/features/Converter/Converter.tsx`

#### Visual Layout

```
┌────────────────────────────────────────────────────────────┐
│  Gradient Accent Line                                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ [100] [🇺🇸 USD ▼] | ⇄ | [$85.00] [🇪🇺 EUR ▼]      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Exchange Rate Pills:                                      │
│  [1 USD = 0.85 EUR] [1 EUR = 1.18 USD]                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Sub-Components

1. **InlineCurrencySelect.tsx** - Searchable currency dropdown
   - Search/filter by code or name
   - Flag emoji display
   - Keyboard navigation (Enter, Escape)
   - Auto-scroll to selected item
   - Click-outside detection
   - RTL support
   - Max height: 280px (220px list + 60px search)

2. **SwapButton.tsx** - Currency swap button
   - Circular gradient button (indigo → purple)
   - Animated rotate on hover (180°)
   - Size: 40x40px
   - SVG arrow icon

3. **AmountInput** (inline) - Number input for amount
   - Range: 0 to 999,999,999,999
   - Decimal support
   - Input validation
   - Placeholder: "0"

4. **ResultDisplay** (inline) - Conversion result
   - Currency symbol display
   - Formatted number output
   - Loading skeleton
   - Error state

#### State Management

```typescript
interface ConverterState {
  amount: number;          // Default: 1
  fromCurrency: string;    // Default: 'USD'
  toCurrency: string;      // Default: 'EUR'
}
```

**Persistence**: localStorage with key `'cofinance-state'`

#### Features

✅ **Single Unified Box Design**
- All elements in one bordered container
- Internal borders separate sections
- Responsive: horizontal (desktop) / vertical (mobile)

✅ **Real-time Conversion**
- Debounced API calls (150ms)
- React Query caching (30 seconds)
- Auto-retry on failure (3 attempts)

✅ **Search & Select Currencies**
- Filter by code (USD, EUR) or name
- Scrollable list with flags
- Smart keyboard shortcuts

✅ **Exchange Rate Display**
- Bidirectional rates (1 USD = X EUR, 1 EUR = X USD)
- Compact pill design
- Monospace font for numbers

✅ **Error Handling**
- Validation error (same currency)
- Network error with retry button
- Loading states

### 2. Currency Select Component

**Location**: `/frontend/src/components/features/Converter/InlineCurrencySelect.tsx`

#### Features

```typescript
interface InlineCurrencySelectProps {
  value: string;              // Current selected currency code
  onChange: (value: string) => void;
  currencies?: Currency[];     // List of available currencies
}
```

**Search Algorithm**:
- Case-insensitive
- Matches currency code OR name
- Filters in real-time

**Keyboard Shortcuts**:
- `Enter`: Select first filtered result
- `Escape`: Close dropdown and clear search

### 3. Other Feature Components

#### ExchangeRates
- Grid display of all currency rates
- Sortable by currency code
- Flag emoji display
- Responsive grid layout

#### QuickConversions
- Preset conversion pairs
- Fast access to common conversions
- Click to update main converter

#### HistoricalRates
- Date range picker
- Chart visualization
- Historical trend data
- Powered by Frankfurter API

---

## Features

### Core Features

1. **Multi-Currency Support**: 160+ currencies
2. **Real-time Exchange Rates**: Updated via Frankfurter API
3. **Searchable Currency Selector**: Fast, filterable dropdowns
4. **Responsive Design**: Mobile-first, works on all screen sizes
5. **Dark Mode**: System preference + manual toggle
6. **Multi-language**: EN, FA (Farsi), AR, ES, FR, DE, JA
7. **PWA Support**: Installable, offline-capable
8. **SEO Optimized**: Meta tags, structured data
9. **Persistent State**: LocalStorage for user preferences
10. **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Currency Data

**Popular Currencies** (Priority Order):
```typescript
IRR, USD, EUR, GBP, JPY, CHF, CAD, AUD, CNY
```

**Currency Flags** (`CURRENCY_FLAGS`):
- 🇺🇸 USD - United States Dollar
- 🇪🇺 EUR - Euro
- 🇬🇧 GBP - British Pound
- 🇯🇵 JPY - Japanese Yen
- 🇨🇭 CHF - Swiss Franc
- 🇨🇦 CAD - Canadian Dollar
- 🇦🇺 AUD - Australian Dollar
- 🇨🇳 CNY - Chinese Yuan
- 🇮🇷 IRR - Iranian Rial
- ... (160+ total)

**Currency Symbols** (`CURRENCY_SYMBOLS`):
```typescript
USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
INR: '₹', RUB: '₽', BRL: 'R$', ZAR: 'R', THB: '฿'
// ... 30+ symbols
```

---

## State Management

### React Query Configuration

```typescript
// Cache Time: 5 minutes (data stays in cache)
// Stale Time: Varies by query type
// Retry: 3 attempts with exponential backoff

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      cacheTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### Query Hooks

#### 1. useConvert

```typescript
useConvert(from: string, to: string, amount: number)
```

**Purpose**: Convert amount from one currency to another

**Query Key**: `['convert', from, to, debouncedAmount]`

**Debounce**: 150ms (reduced from 300ms for faster response)

**Stale Time**: 30 seconds

**Enabled**: Only when `amount > 0` AND `from !== to`

**Returns**:
```typescript
{
  data: ConversionResult | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

#### 2. useCurrencies

```typescript
useCurrencies()
```

**Purpose**: Fetch list of all available currencies

**Query Key**: `['currencies']`

**Stale Time**: 1 hour (data changes rarely)

**Returns**:
```typescript
{
  data: Currency[] | undefined;
}
```

#### 3. useRates

```typescript
useRates(baseCurrency: string)
```

**Purpose**: Get all exchange rates for a base currency

**Query Key**: `['rates', baseCurrency]`

**Returns**: Map of currency codes to rates

#### 4. useHistorical

```typescript
useHistorical(from: string, to: string, startDate: string, endDate: string)
```

**Purpose**: Fetch historical exchange rate data

**Query Key**: `['historical', from, to, startDate, endDate]`

**Returns**: Time series data for charting

### Context Providers

#### ThemeContext

```typescript
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}
```

**Persistence**: localStorage key `'theme'`

**System Detection**: `window.matchMedia('(prefers-color-scheme: dark)')`

#### LanguageContext

```typescript
type Language = 'en' | 'fa' | 'ar' | 'es' | 'fr' | 'de' | 'ja';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}
```

**Persistence**: localStorage key `'language'`

**RTL Languages**: Farsi (fa), Arabic (ar)

---

## API Integration

### Frankfurter API

**Base URL**: `https://api.frankfurter.app`

#### Endpoints Used

1. **Get Available Currencies**
   ```
   GET /currencies
   ```
   Response:
   ```json
   {
     "USD": "United States Dollar",
     "EUR": "Euro",
     ...
   }
   ```

2. **Convert Currency**
   ```
   GET /latest?from={from}&to={to}&amount={amount}
   ```
   Response:
   ```json
   {
     "amount": 100,
     "base": "USD",
     "date": "2024-01-07",
     "rates": {
       "EUR": 85.23
     }
   }
   ```

3. **Get All Rates**
   ```
   GET /latest?from={base}
   ```

4. **Historical Data**
   ```
   GET /{startDate}..{endDate}?from={from}&to={to}
   ```

### Error Handling

**Retry Strategy**:
- 3 attempts
- Exponential backoff: 1s, 2s, 4s
- Max delay: 30s

**Error Display**:
- User-friendly error messages
- Retry button in UI
- Network error detection

---

## Styling & Theming

### Tailwind CSS Configuration

**Color Palette**:
```javascript
colors: {
  primary: {
    gradient: 'from-indigo-500 via-purple-500 to-pink-500'
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    // ... through 900
  }
}
```

**Dark Mode**:
- Class-based (`dark:` prefix)
- Controlled by ThemeContext
- System preference detection

### Design System

**Typography**:
- Font weights: light (300), medium (500), semibold (600), bold (700)
- Sizes: xs (11px), sm (13px), base (16px), lg, xl, 2xl, 3xl

**Spacing**:
- Gap: 1.5 (6px), 2 (8px), 3 (12px), 4 (16px), 5 (20px)
- Padding: p-3, p-4, p-5 for cards
- Margin: Auto-centered with mx-auto

**Border Radius**:
- lg: 0.5rem
- xl: 0.75rem
- 2xl: 1rem
- full: 9999px (pills/circles)

**Shadows**:
- sm: Subtle elevation
- md: Card elevation
- lg: Modal/dropdown elevation
- xl: Max elevation

**Transitions**:
- Duration: 150ms (quick), 200ms (default), 500ms (slow)
- Easing: Default ease-in-out

### Responsive Breakpoints

```javascript
screens: {
  'sm': '640px',   // Tablet
  'md': '768px',   // Small laptop
  'lg': '1024px',  // Desktop
  'xl': '1280px',  // Large desktop
  '2xl': '1536px'  // Extra large
}
```

**Mobile-First Approach**:
- Default styles: Mobile
- `sm:`: Tablet and up
- `lg:`: Desktop and up

### Key CSS Classes

**Glass Morphism**:
```css
bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
```

**Gradient Accent**:
```css
bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
```

**Hover Effects**:
```css
hover:border-indigo-400 dark:hover:border-indigo-500
transition-all duration-200
```

**Focus States**:
```css
focus:outline-none focus:ring-2 focus:ring-indigo-500/30
```

---

## File Structure

### Key Files

#### `/frontend/src/App.tsx`

Main application component with routing:

```tsx
<BrowserRouter>
  <QueryClientProvider>
    <LanguageProvider>
      <ThemeProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/currencies" element={<Currencies />} />
          <Route path="/rates" element={<Rates />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </ThemeProvider>
    </LanguageProvider>
  </QueryClientProvider>
</BrowserRouter>
```

**Layout Structure**:
```
├── Header (sticky, top navigation)
├── Main Content (flex-1, scrollable)
│   ├── Converter Section (lg:7/12)
│   ├── Quick Conversions (lg:5/12)
│   ├── Exchange Rates Grid (lg:12/12)
│   └── Historical Rates (lg:12/12)
└── Footer (company info, links)
```

#### `/frontend/src/types/currency.ts`

Type definitions:

```typescript
export interface Currency {
  code: string;      // e.g., "USD"
  name: string;      // e.g., "United States Dollar"
  symbol: string;    // e.g., "$"
  priority: number;  // Sort order (lower = higher priority)
}

export interface ConversionResult {
  from: string;      // Source currency code
  to: string;        // Target currency code
  amount: number;    // Input amount
  result: number;    // Converted amount
  rate: number;      // Exchange rate
  updated_at: string; // ISO timestamp
}

export interface ExchangeRate {
  currency: string;
  rate: number;
  updated_at: string;
}

export interface HistoricalData {
  date: string;
  rate: number;
}
```

#### `/frontend/src/utils/format.ts`

Number formatting utilities:

```typescript
// Format numbers with locale-specific separators
export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

// Format exchange rates (up to 6 decimals for precision)
export function formatRate(rate: number): string {
  if (rate >= 1) {
    return formatNumber(rate, 2);
  }
  // For small rates, show more decimals
  return rate.toFixed(6).replace(/\.?0+$/, '');
}
```

#### `/frontend/src/utils/constants.ts`

Static data:

```typescript
export const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  // ... 160+ currencies
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  // ... 30+ symbols
};

export const POPULAR_CURRENCIES = [
  'IRR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'
];
```

---

## Key Implementation Details

### 1. Debounced Input

To avoid excessive API calls while typing:

```typescript
// Custom hook: useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in useConvert
const debouncedAmount = useDebounce(amount, 150); // 150ms delay
```

### 2. LocalStorage Persistence

Converter state is saved/loaded from localStorage:

```typescript
const STORAGE_KEY = 'cofinance-state';

function loadState(): ConverterState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        amount: typeof parsed.amount === 'number' && parsed.amount > 0
          ? parsed.amount : 1,
        fromCurrency: typeof parsed.fromCurrency === 'string'
          ? parsed.fromCurrency : 'USD',
        toCurrency: typeof parsed.toCurrency === 'string'
          ? parsed.toCurrency : 'EUR',
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { amount: 1, fromCurrency: 'USD', toCurrency: 'EUR' };
}

// Auto-save on every change
useEffect(() => {
  saveState({ amount, fromCurrency, toCurrency });
}, [amount, fromCurrency, toCurrency]);
```

### 3. Click Outside Detection

Close dropdown when clicking outside:

```typescript
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (containerRef.current &&
        !containerRef.current.contains(event.target as Node)) {
      setIsOpen(false);
      setSearch('');
    }
  }

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

### 4. Auto-Scroll to Selected

When dropdown opens, scroll to selected currency:

```typescript
useEffect(() => {
  if (isOpen && listRef.current) {
    const selectedItem = listRef.current.querySelector('[data-selected="true"]');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }
}, [isOpen]);
```

### 5. Input Validation

Prevent invalid amount values:

```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const val = parseFloat(e.target.value);
  if (isNaN(val)) {
    setAmount(0);
  } else if (val < 0) {
    setAmount(0);  // No negative amounts
  } else if (val > 999999999999) {
    setAmount(999999999999);  // Max 999 billion
  } else {
    setAmount(val);
  }
};
```

### 6. Responsive Layout Strategy

**Mobile (< 640px)**:
```tsx
<div className="flex flex-col">  {/* Stack vertically */}
  <div>Amount + FROM</div>
  <div>Swap Button</div>
  <div>Result + TO</div>
</div>
```

**Desktop (≥ 640px)**:
```tsx
<div className="sm:flex-row">  {/* Horizontal layout */}
  <div>Amount + FROM</div> | <div>⇄</div> | <div>Result + TO</div>
</div>
```

### 7. Dark Mode Implementation

```typescript
// ThemeContext.tsx
const [theme, setTheme] = useState<Theme>(() => {
  const saved = localStorage.getItem('theme');
  return (saved as Theme) || 'system';
});

const isDark = useMemo(() => {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return theme === 'dark';
}, [theme]);

useEffect(() => {
  document.documentElement.classList.toggle('dark', isDark);
}, [isDark]);
```

### 8. RTL Language Support

```typescript
const isRTL = useMemo(() => {
  return language === 'fa' || language === 'ar';
}, [language]);

useEffect(() => {
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}, [isRTL, language]);

// Usage in components
<div className={`${isRTL ? 'right-0' : 'left-0'}`}>
```

---

## Data Flow

### Conversion Flow

```
User Types Amount (100)
       ↓
Debounce (150ms)
       ↓
useConvert Hook
       ↓
React Query Cache Check
       ↓ (if stale or missing)
API Call: /latest?from=USD&to=EUR&amount=100
       ↓
Response: { amount: 100, rates: { EUR: 85.23 } }
       ↓
Cache Result (30s stale time)
       ↓
Update UI: Display €85.23
```

### Currency Selection Flow

```
User Clicks Currency Dropdown
       ↓
Dropdown Opens
       ↓
Focus Search Input
       ↓
User Types "euro"
       ↓
Filter Currencies (case-insensitive)
       ↓
Display Filtered Results
       ↓
User Clicks EUR or Presses Enter
       ↓
Update Currency State
       ↓
Trigger Conversion (if amount > 0)
```

### Theme Change Flow

```
User Clicks Theme Toggle
       ↓
setTheme('dark')
       ↓
Save to localStorage
       ↓
Update Context State
       ↓
isDark Computed (true)
       ↓
Add 'dark' class to <html>
       ↓
Tailwind Dark Mode Styles Applied
```

---

## Performance Optimizations

### 1. React Query Caching
- **Currencies**: Cached for 1 hour (rarely changes)
- **Conversions**: Cached for 30 seconds
- **Rates**: Cached per base currency

### 2. Debouncing
- Amount input debounced 150ms
- Prevents API spam while typing

### 3. Code Splitting
- Route-based code splitting with React.lazy
- Smaller initial bundle size

### 4. Memoization
```typescript
const filteredCurrencies = useMemo(() => {
  // Expensive filtering only when dependencies change
}, [currencies, search]);

const validationError = useMemo(() => {
  if (fromCurrency === toCurrency) return t('sameCurrency');
}, [fromCurrency, toCurrency, t]);
```

### 5. useCallback for Event Handlers
```typescript
const handleSwap = useCallback(() => {
  setFromCurrency(toCurrency);
  setToCurrency(fromCurrency);
}, [fromCurrency, toCurrency]);
```

---

## Accessibility Features

### ARIA Labels
```tsx
<button aria-label="Swap currencies" />
<input aria-describedby="amount-error" />
<div role="alert" aria-live="assertive">Error message</div>
<select aria-label="Select currency" />
```

### Keyboard Navigation
- **Tab**: Navigate through inputs
- **Enter**: Submit/select
- **Escape**: Close dropdowns
- **Arrow keys**: Navigate dropdown lists (native select)

### Screen Reader Support
- Proper semantic HTML (button, input, select)
- Live regions for dynamic content
- Descriptive labels for all interactive elements

### Focus Management
- Visible focus rings
- Auto-focus search input when dropdown opens
- Focus trap in modals/dropdowns

---

## Testing Considerations

### Unit Tests (Not Yet Implemented)
- Format utilities (`formatNumber`, `formatRate`)
- Constants validation
- Translation key coverage

### Integration Tests (Not Yet Implemented)
- Converter component behavior
- Currency selection flow
- API error handling
- LocalStorage persistence

### E2E Tests (Not Yet Implemented)
- Full conversion workflow
- Multi-language switching
- Theme toggling
- Responsive layouts

---

## Environment Variables

```bash
# No environment variables currently used
# API endpoint is hardcoded to Frankfurter
```

---

## Build & Deployment

### Development
```bash
cd frontend
npm install
npm run dev     # Vite dev server on port 5173
```

### Production Build
```bash
npm run build   # TypeScript compile + Vite build
npm run preview # Preview production build
```

### Build Output
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js   # Main JS bundle (~285KB)
│   └── index-[hash].css  # Tailwind CSS (~63KB)
├── sw.js                 # Service Worker
└── manifest.webmanifest  # PWA manifest
```

---

## Recent Changes (Current Branch)

### Branch: `claude/currency-conversion-input-SowpK`

**Commits**:
1. ✅ `138c753` - feat: Add searchable currency dropdown to inline converter
2. ✅ `713fedc` - chore: Remove unused component files
3. ✅ `bdb481c` - refactor: Consolidate CoFinance into single inline box
4. ✅ `1f05f1a` - feat: Redesign CoFinance with inline input layout

**Key Changes**:
- Unified single-box design for converter
- Inline layout: `[Amount + FROM] | [⇄] | [Result + TO]`
- Searchable dropdown with InlineCurrencySelect component
- Removed separate AmountCurrencyInput and ResultCurrencyDisplay
- Maintained all functionality while improving UX

---

## Future Enhancements (Potential)

1. **Favorites**: Save frequently used currency pairs
2. **Comparison Mode**: Compare multiple currencies at once
3. **Calculator Mode**: Complex multi-currency calculations
4. **Charts**: Visual representation of rate changes
5. **Notifications**: Alert on rate changes
6. **Export**: Download conversion history
7. **API Key**: Support for premium API endpoints
8. **Offline Mode**: Enhanced PWA with offline conversions
9. **Multi-Amount**: Convert multiple amounts simultaneously
10. **Voice Input**: Accessibility enhancement

---

## Troubleshooting

### Common Issues

**1. Build Errors - Missing Dependencies**
```bash
# Solution:
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**2. TypeScript Errors**
```bash
# Check TypeScript version
npx tsc --version

# Rebuild
npm run build
```

**3. API Rate Limiting**
- Frankfurter API has no documented rate limits
- React Query caching reduces requests
- If issues persist, implement request throttling

**4. LocalStorage Full**
```javascript
// Clear converter state
localStorage.removeItem('cofinance-state');
```

**5. Dark Mode Not Working**
```javascript
// Check localStorage theme
console.log(localStorage.getItem('theme'));

// Reset
localStorage.removeItem('theme');
```

---

## Git Workflow

### Branch Naming
```
claude/<feature-name>-<sessionId>
```

Example: `claude/currency-conversion-input-SowpK`

### Commit Message Format
```
<type>: <subject>

<body>

<footer>
```

Types: feat, fix, refactor, chore, docs, style, test

### Push Command
```bash
git push -u origin claude/<branch-name>
```

---

## Contact & Links

- **Repository**: https://github.com/rezacr588/cofinance
- **API**: https://www.frankfurter.app/
- **Developer**: Reza (rezacr588)

---

**Last Updated**: 2026-01-07
**Documentation Version**: 1.0.0
**Application Version**: See package.json
