# CoFinance - Personal Finance Features Guide

## Overview

CoFinance is an all-in-one personal finance application that combines currency conversion, multi-currency wallet management, and AI-powered receipt parsing. Perfect for managing finances across multiple currencies.

## Current Features

### 1. CoFinance
- **160+ Currencies**: Convert between any of 160+ world currencies
- **Real-time Rates**: Powered by European Central Bank data
- **Special IRR Support**: Iranian Rial with dedicated data source
- **Historical Rates**: Look up exchange rates for any date since 1999
- **Quick Conversions**: Popular currency pairs at a glance

### 2. User Authentication
- **Secure Registration**: Email-based account creation
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Access Tokens**: 15-minute expiry for security
- **Refresh Tokens**: 7-day expiry for convenience
- **Account Lockout**: Protection against brute-force attacks (5 failed attempts)
- **Password Reset**: Email-based password recovery flow

### 3. Multi-Currency Wallet
- **Track Multiple Currencies**: Maintain balances in any currency
- **Real-time Conversion**: Convert between wallet currencies instantly
- **Transaction History**: Full audit trail of all transactions
- **Balance Overview**: Dashboard showing all currency balances
- **Total Balance (USD)**: Aggregated balance converted to USD

### 4. Transaction Management
- **Transaction Types**:
  - Credit (Income/Deposit)
  - Debit (Expense/Withdrawal)
  - Convert (Currency conversion)
- **Categories**: 8 default categories + custom categories
  - Food
  - Transportation
  - Entertainment
  - Shopping
  - Bills
  - Income
  - Transfer
  - Other
- **Transaction Filters**:
  - Search by description
  - Filter by category
  - Filter by type (credit/debit/convert)
  - Filter by currency
  - Filter by date range
- **CSV Export**: Download transaction history as CSV

### 5. AI Receipt Parser
- **Smart Extraction**: AI automatically extracts transaction details from receipt text
- **Multi-Transaction**: Parse receipts with multiple line items
- **Confidence Scores**: See AI confidence for each extracted transaction
- **One-Click Apply**: Apply parsed transactions directly to wallet
- **Powered by Cerebras**: Fast, accurate LLM-based parsing

### 6. Dashboard Analytics
- **Spending by Category**: Visual breakdown of expenses
- **Income vs Expenses**: Compare money in vs money out
- **Balance Distribution**: See how funds are distributed across currencies

### 7. User Onboarding
- **Welcome Wizard**: 4-step setup for new users
- **Currency Selection**: Choose primary display currency
- **First Transaction**: Add initial balance during setup

### 8. Multi-Language Support
- English
- Persian (فارسی) with RTL
- Arabic (العربية) with RTL
- Turkish (Türkçe)
- Automatic detection from browser locale

### 9. Progressive Web App (PWA)
- **Installable**: Add to home screen on mobile
- **Offline Support**: Basic functionality without internet
- **Fast Loading**: Service worker caching

### 10. Planner Offline Sync
- **Outbox Queue**: Operations queued locally with mutex-serialized writes (max 500 ops)
- **Sync Engine**: Sequential processing with exponential backoff, crash recovery for stuck ops
- **Local Backup**: Board state backed up with timestamps; order-independent equality comparison
- **Conflict Handling**: Goal funding required (409) detected and surfaced to user; retries with configurable max attempts
- **API Timeout**: 30s AbortController timeout on all planner API requests

### 11. Security Features
- **Rate Limiting**: Per-IP request limits
- **Authenticated Rate Limits**: Higher limits for logged-in users
- **Login Protection**: Stricter limits on login attempts
- **Account Lockout**: Automatic lockout after failed attempts
- **HTTPS**: Secure communication
- **CORS Protection**: Cross-origin request filtering

### 12. Financial Goals
- **Savings Targets**: Create goals with target amounts and deadlines
- **Progress Tracking**: Visual progress bars and contribution history
- **Goal Categories**: Emergency fund, vacation, home, car, education, retirement, investment, debt payoff
- **Contributions**: Contribute from wallet balance directly to goals
- **Multi-Currency**: Goals in any supported currency

### 13. Recurring Transactions
- **Scheduling**: Daily, weekly, monthly, or yearly frequencies
- **Auto-Execution**: Manual or automatic transaction creation
- **Active/Inactive Toggle**: Pause and resume recurring transactions
- **Next Execution Date**: Track when the next transaction will occur

### 14. Budgets
- **Category Budgets**: Set spending limits per category
- **Period Tracking**: Monthly or yearly budget periods
- **Progress Monitoring**: Spent amount, remaining balance, percentage used
- **Alerts**: Near-limit and over-budget warnings

### 15. Reports & Analytics
- **Monthly/Yearly Reports**: Income, expenses, and savings summaries
- **Category Breakdown**: Spending distribution by category with percentages
- **Spending Trends**: Income vs expense trends over configurable time periods
- **Net Worth Tracking**: Total balance distribution across currencies
- **Financial Forecasting**: Projected income and expenses
- **Health Score**: Overall financial health assessment
- **Weekly Recap**: Summary of the past week's financial activity
- **Cash Flow Projections**: Forward-looking cash flow analysis
- **Spending Anomaly Detection**: Alerts for unusual spending patterns

### 16. Subscriptions Tracking
- **Subscription Management**: Track active subscriptions with billing cycles
- **Billing Cycles**: Weekly, monthly, quarterly, yearly tracking
- **Upcoming Payments**: See what's due soon
- **Summary View**: Total subscription costs and category breakdown
- **Categories**: Organize subscriptions by type

### 17. Loans Management
- **Loan Tracking**: Record loans with amounts, interest rates, and terms
- **Payment History**: Log individual loan payments
- **Summary View**: Outstanding balance and total paid
- **Upcoming Payments**: See upcoming loan payment due dates

### 18. Notes System
- **Rich Notes**: Create notes with color coding
- **Pinned Notes**: Pin important notes to the top
- **Transaction Links**: Attach notes to specific transactions
- **Color Palette**: Choose from multiple note colors for organization

### 19. Challenges & Gamification
- **Financial Challenges**: Join challenges to improve financial habits
- **XP System**: Earn experience points for financial activities
- **Badges**: Unlock badges for achievements
- **Daily Rewards**: Claim daily rewards for engagement
- **Leaderboard**: Compare progress with other users
- **Featured Challenges**: Curated challenges for new users

### 20. Smart Financial Advice
- **AI-Powered Tips**: Personalized advice based on your spending patterns, balances, and goals
- **Context-Aware**: Analyzes your financial data to provide relevant suggestions
- **Dismiss & Refresh**: Dismiss tips you've seen, refresh for new advice
- **Fallback Tips**: Static financial tips when AI is unavailable
- **Categories**: Spending, saving, budgeting, investing, and general advice

### 21. Financial News Feed
- **Aggregated News**: Financial news from MarketWatch, Yahoo Finance, and CNBC
- **Categorized Articles**: Markets, finance, economy, and crypto categories
- **Cached Feed**: News cached for fast loading (30-minute refresh)
- **External Links**: Open full articles in browser

### 22. Enhanced AI Chat
- **Voice Recording**: Record voice messages (up to 2 minutes) for AI interaction
- **Image Attachments**: Attach photos of receipts and invoices for AI parsing
- **Vision Model Support**: AI can read and extract data from receipt/invoice images
- **Document Attachments**: Attach documents for AI analysis
- **Multi-Provider**: Supports Groq, OpenAI, Google AI, and Cerebras AI providers

---

## Getting Started

### 1. Create an Account
1. Click "Register" on the home page
2. Enter your email, password, and name
3. Complete the onboarding wizard

### 2. Set Up Your Wallet
1. Choose your primary currency
2. Add your first transaction (initial balance)
3. Start tracking your finances

### 3. Add Transactions
- Click "Add Transaction" on the wallet page
- Choose Credit (income) or Debit (expense)
- Select currency, amount, and category
- Add optional description

### 4. Convert Currencies
- Click "Convert Currency"
- Select source and target currencies
- Enter amount to convert
- See live exchange rate preview
- Click "Convert" to complete

### 5. Use AI Parser
- Click "AI Parser" on the wallet page
- Paste receipt or invoice text
- Review extracted transactions
- Apply to wallet with one click

---

## API Quick Reference

| Feature | Endpoint | Method |
|---------|----------|--------|
| Register | `/api/v1/auth/register` | POST |
| Login | `/api/v1/auth/login` | POST |
| Refresh Token | `/api/v1/auth/refresh` | POST |
| Forgot Password | `/api/v1/auth/forgot-password` | POST |
| Reset Password | `/api/v1/auth/reset-password` | POST |
| Get Balances | `/api/v1/wallet/balances` | GET |
| Get Transactions | `/api/v1/wallet/transactions` | GET |
| Add Transaction | `/api/v1/wallet/transaction` | POST |
| Convert | `/api/v1/wallet/convert` | POST |
| Export CSV | `/api/v1/wallet/transactions/export` | GET |
| Get Categories | `/api/v1/wallet/categories` | GET |
| Parse Receipt | `/api/v1/ai/parse` | POST |
| Health Check | `/health` | GET |
| Detailed Health | `/health/detailed` | GET |

See [API.md](./API.md) for full documentation.

---

## Technical Stack

### Backend
- **Language**: Go 1.24+
- **Router**: Chi
- **Database**: PostgreSQL (Neon, pgx/pgxpool)
- **Vector DB**: Qdrant (semantic memory)
- **Cache**: In-memory (go-cache + singleflight)
- **AI**: LangChainGo with multi-provider support (Groq, OpenAI, Google AI, Cerebras)
- **Auth**: JWT (golang-jwt/v5) with OAuth (Google, LinkedIn)

### Client App (Web + Mobile)
- **Framework**: Expo ~54, React Native 0.81
- **Language**: TypeScript
- **Routing**: Expo Router (file-based)
- **Web**: React Native Web (Expo web export)
- **Styling**: styled-components/native
- **State**: TanStack Query
- **Charts**: react-native-gifted-charts
- **Testing**: jest-expo, @testing-library/react-native

### Infrastructure
- **Container**: Docker (3-stage build)
- **Deployment**: Koyeb (web), EAS (mobile OTA updates)
- **CI/CD**: GitHub Actions (web + mobile workflows)
