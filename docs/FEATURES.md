# CoFinance - Personal Finance Features Guide

## Overview

CoFinance is an all-in-one personal finance application that combines currency conversion, multi-currency wallet management, and AI-powered receipt parsing. Perfect for managing finances across multiple currencies.

## Current Features

### 1. Currency Converter
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

### 10. Security Features
- **Rate Limiting**: Per-IP request limits
- **Authenticated Rate Limits**: Higher limits for logged-in users
- **Login Protection**: Stricter limits on login attempts
- **Account Lockout**: Automatic lockout after failed attempts
- **HTTPS**: Secure communication
- **CORS Protection**: Cross-origin request filtering

---

## Planned Features (Roadmap)

### Phase 3: Advanced Personal Finance

#### Financial Goals
- Create savings goals with target amounts
- Track progress toward goals
- Multiple goals per currency
- Goal categories (Emergency Fund, Vacation, etc.)
- Automatic progress calculation

#### Transaction Notes & Attachments
- Add detailed notes to transactions
- Attach receipt images (OCR planned)
- Tag transactions with custom labels
- Search within notes

#### Reports & Statistics
- Monthly spending reports
- Category breakdown over time
- Income trend analysis
- Net worth tracking
- Custom date range reports
- PDF export

#### Recurring Transactions
- Schedule recurring income/expenses
- Daily, weekly, monthly, yearly frequencies
- Automatic transaction creation
- Reminder notifications

#### Budgets
- Set monthly budgets per category
- Budget alerts and warnings
- Rollover unused budget
- Budget vs actual visualization

#### Transaction Types Enhancement
- More granular transaction types
- Custom transaction type creation
- Transaction type icons and colors

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
- **Language**: Go 1.21+
- **Router**: Chi
- **Database**: PostgreSQL (pgx)
- **Cache**: In-memory (go-cache)
- **AI**: LangChainGo + Cerebras
- **Auth**: JWT (golang-jwt/v5)

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build**: Vite
- **State**: TanStack Query
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **PWA**: Workbox

### Infrastructure
- **Container**: Docker
- **Deployment**: Koyeb
- **CI/CD**: GitHub Actions
