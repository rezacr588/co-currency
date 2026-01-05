# Personal Finance App - Implementation Plan

## Overview

Transform the currency converter into a full-featured personal finance application with AI-powered insights, multi-currency support, and comprehensive budget management.

---

## Core Smart Features

### Smart Transaction Intelligence

**1. Auto-detect Income vs Expense (AI-powered)**
- AI analyzes transaction description to determine type
- "Salary from Company X" → Automatically marked as Income
- "Amazon.com purchase" → Automatically marked as Expense
- "Transfer from John" → AI suggests Income (user can override)
- Confidence score shown, user can always correct

**2. Running Balance Tracking**
- Each user has a real-time balance in their base currency
- Income transactions → ADD to balance
- Expense transactions → SUBTRACT from balance
- Balance history tracked over time
- Dashboard shows current balance prominently

**3. Automatic Currency Conversion**
- Transactions can be entered in ANY currency
- System auto-converts to user's base currency for:
  - Balance calculation
  - Budget tracking
  - Reports and analytics
- Uses live exchange rates from existing Frankfurter API
- Stores both original amount/currency AND converted amount
- Shows both values in transaction list

**Example Flow:**
```
User's base currency: USD
User adds: "Dinner in Paris" - €50 EUR

AI detects:
  - Type: Expense (restaurant = food category)
  - Category: Food & Dining (auto-suggested)

System converts:
  - Original: €50.00 EUR
  - Converted: $54.25 USD (at current rate)

Balance updated:
  - Previous: $2,505.00
  - After: $2,450.75 (-$54.25)
```

### Database Support for Smart Features

```sql
-- Add to transactions table
amount_base_currency DECIMAL(15, 2),  -- Converted amount
exchange_rate DECIMAL(15, 8),          -- Rate used at time of transaction
ai_detected_type VARCHAR(10),          -- AI suggestion
ai_confidence DECIMAL(3, 2),           -- Confidence score (0.00-1.00)

-- Add balance tracking to users
current_balance DECIMAL(15, 2) DEFAULT 0,
balance_updated_at TIMESTAMP
```

---

## Complete Transaction History & Audit Trail

### Overview

Full historical tracking of all financial activity with audit logs, balance snapshots, and timeline views. Never lose track of any transaction or balance change.

### Features

**1. Transaction Audit Log**
- Every create, update, delete is logged
- See what changed, when, and previous values
- Immutable audit trail for accountability
- Soft deletes (transactions never truly deleted)

**2. Balance History**
- Daily/monthly balance snapshots
- See balance at any point in time
- Track net worth over months/years
- Visual balance timeline chart

**3. Monthly/Yearly Summaries**
- Auto-generated monthly reports
- Income vs expense breakdown
- Category spending comparison
- Year-over-year trends

**4. Advanced Search & Filters**
- Search all historical transactions
- Filter by date range, amount, category
- Full-text search on descriptions
- Export filtered results

**5. Timeline View**
- Chronological activity feed
- Group by day/week/month
- Running balance shown
- Quick navigation to any period

### Database Schema for History

```sql
-- Transaction Audit Log (immutable history)
CREATE TABLE transaction_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(10) CHECK (action IN ('create', 'update', 'delete')),
    old_values JSONB,          -- Previous state (null for create)
    new_values JSONB,          -- New state (null for delete)
    changed_fields TEXT[],     -- List of fields that changed
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Balance Snapshots (daily/monthly)
CREATE TABLE balance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    snapshot_type VARCHAR(10) CHECK (snapshot_type IN ('daily', 'monthly', 'yearly')),
    balance DECIMAL(15, 2) NOT NULL,
    total_income DECIMAL(15, 2) DEFAULT 0,
    total_expenses DECIMAL(15, 2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, snapshot_date, snapshot_type)
);

-- Monthly Summaries (pre-calculated for performance)
CREATE TABLE monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    opening_balance DECIMAL(15, 2),
    closing_balance DECIMAL(15, 2),
    total_income DECIMAL(15, 2),
    total_expenses DECIMAL(15, 2),
    net_change DECIMAL(15, 2),
    category_breakdown JSONB,   -- { "Food": 500, "Transport": 200, ... }
    transaction_count INTEGER,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, year, month)
);

-- Soft delete support for transactions
ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE transactions ADD COLUMN deleted_by UUID;

-- Indexes for history queries
CREATE INDEX idx_audit_log_transaction ON transaction_audit_log(transaction_id);
CREATE INDEX idx_audit_log_user_date ON transaction_audit_log(user_id, created_at);
CREATE INDEX idx_balance_snapshots_user_date ON balance_snapshots(user_id, snapshot_date);
CREATE INDEX idx_monthly_summaries_user ON monthly_summaries(user_id, year, month);
CREATE INDEX idx_transactions_deleted ON transactions(user_id, deleted_at) WHERE deleted_at IS NULL;
```

### API Endpoints for History

```
GET /api/history/timeline          - Activity timeline with pagination
GET /api/history/balance           - Balance history over time
GET /api/history/audit/:id         - Audit log for specific transaction
GET /api/history/snapshots         - Balance snapshots (daily/monthly)
GET /api/history/summaries         - Monthly/yearly summaries
GET /api/history/search            - Full-text search across all transactions
GET /api/history/export            - Export history to CSV/PDF
POST /api/history/restore/:id      - Restore soft-deleted transaction
```

### Timeline API Response Example

```json
// GET /api/history/timeline?from=2024-01-01&to=2024-01-31
{
  "timeline": [
    {
      "date": "2024-01-15",
      "transactions": [
        {
          "id": "uuid",
          "time": "14:30:00",
          "type": "expense",
          "description": "Grocery shopping",
          "amount": -85.50,
          "currency": "USD",
          "category": "Food & Dining",
          "balance_after": 2450.75
        },
        {
          "id": "uuid",
          "time": "09:00:00",
          "type": "income",
          "description": "Salary deposit",
          "amount": 3500.00,
          "currency": "USD",
          "category": "Salary",
          "balance_after": 2536.25
        }
      ],
      "daily_summary": {
        "income": 3500.00,
        "expenses": 85.50,
        "net": 3414.50,
        "opening_balance": -963.75,
        "closing_balance": 2450.75
      }
    }
  ],
  "period_summary": {
    "total_income": 5000.00,
    "total_expenses": 3200.00,
    "net_change": 1800.00,
    "start_balance": 650.75,
    "end_balance": 2450.75
  }
}
```

### Balance History Response Example

```json
// GET /api/history/balance?period=6months&interval=weekly
{
  "balance_history": [
    { "date": "2024-01-01", "balance": 1500.00 },
    { "date": "2024-01-08", "balance": 1750.25 },
    { "date": "2024-01-15", "balance": 2100.00 },
    { "date": "2024-01-22", "balance": 1890.50 },
    { "date": "2024-01-29", "balance": 2450.75 }
  ],
  "statistics": {
    "highest": { "date": "2024-01-29", "balance": 2450.75 },
    "lowest": { "date": "2024-01-01", "balance": 1500.00 },
    "average": 1938.30,
    "trend": "increasing",
    "growth_rate": 63.38
  }
}
```

### Frontend Components for History

**Files to create:**
- `frontend/src/pages/History.tsx`
- `frontend/src/components/features/History/Timeline.tsx`
- `frontend/src/components/features/History/TimelineItem.tsx`
- `frontend/src/components/features/History/BalanceChart.tsx`
- `frontend/src/components/features/History/MonthlySummary.tsx`
- `frontend/src/components/features/History/SearchHistory.tsx`
- `frontend/src/components/features/History/AuditLog.tsx`
- `frontend/src/hooks/useHistory.ts`

**UI Features:**
- Infinite scroll timeline grouped by date
- Interactive balance chart (zoom, hover for details)
- Monthly summary cards with comparisons
- Powerful search with filters
- Transaction detail modal with edit history
- Export to CSV/PDF buttons
- Date range picker for navigation
- "Jump to date" quick navigation

### Background Jobs

```go
// Scheduled tasks for history management
- Daily: Create balance snapshots at midnight
- Monthly: Generate monthly summary on 1st of month
- Weekly: Clean up old audit logs (keep 2 years)
- On-demand: Recalculate summaries if needed
```

---

## Smart Email Integration

### Overview

Automatically import transactions from emails - bank notifications, receipts, invoices. AI parses email content, extracts transaction details, categorizes, and updates balance.

### How It Works

```
1. User forwards email to: transactions@yourapp.com
   OR
   User connects Gmail/Outlook for auto-import

2. System receives email

3. AI (Groq) analyzes email:
   - Extracts amount, currency
   - Determines income vs expense
   - Identifies merchant/source
   - Suggests category
   - Extracts date

4. Transaction created automatically
   - Balance updated
   - User notified
```

### Supported Email Types

| Email Type | Example | Extracted Data |
|------------|---------|----------------|
| Bank alerts | "You spent $50.00 at Amazon" | Amount, merchant, type |
| Receipts | "Your Uber receipt - $25.50" | Amount, category, date |
| Invoices | "Invoice #123 - $500 paid" | Amount, description |
| Salary | "Payroll deposit: $3,500" | Amount, income type |
| Subscriptions | "Netflix charged $15.99" | Amount, recurring flag |
| Transfers | "You received $100 from John" | Amount, sender, income |

### Email Parsing with AI

```json
// Input: Raw email content
{
  "from": "alerts@bank.com",
  "subject": "Transaction Alert",
  "body": "You made a purchase of $45.99 at STARBUCKS #12345 on Jan 15, 2024 at 2:30 PM. Your new balance is $2,450.00."
}

// AI Output (Groq processes this)
{
  "transaction": {
    "amount": 45.99,
    "currency": "USD",
    "type": "expense",
    "description": "STARBUCKS #12345",
    "category": "Food & Dining",
    "subcategory": "Coffee",
    "date": "2024-01-15",
    "time": "14:30:00",
    "merchant": "Starbucks"
  },
  "confidence": 0.98,
  "balance_mentioned": 2450.00,
  "needs_review": false
}
```

### Database Schema for Email Import

```sql
-- Email import tracking
CREATE TABLE email_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_from VARCHAR(255),
    email_subject TEXT,
    email_body TEXT,
    raw_email TEXT,
    parsed_data JSONB,
    transaction_id UUID REFERENCES transactions(id),
    status VARCHAR(20) CHECK (status IN ('pending', 'processed', 'failed', 'needs_review')),
    ai_confidence DECIMAL(3, 2),
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Email forwarding addresses (unique per user)
CREATE TABLE email_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) UNIQUE NOT NULL,  -- user123@transactions.yourapp.com
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Connected email accounts (Gmail, Outlook)
CREATE TABLE connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) CHECK (provider IN ('gmail', 'outlook', 'imap')),
    email VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_imports_user ON email_imports(user_id, created_at);
CREATE INDEX idx_email_imports_status ON email_imports(status);
```

### API Endpoints for Email

```
POST /api/email/webhook          - Receive forwarded emails (webhook)
GET  /api/email/imports          - List imported emails
GET  /api/email/imports/:id      - Get import details
POST /api/email/imports/:id/approve  - Approve pending import
POST /api/email/imports/:id/reject   - Reject import
GET  /api/email/address          - Get user's unique email address
POST /api/email/connect/gmail    - Connect Gmail account
POST /api/email/connect/outlook  - Connect Outlook account
DELETE /api/email/disconnect/:id - Disconnect email account
POST /api/email/sync             - Manually trigger sync
```

### Email Import Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Email     │────▶│   Webhook    │────▶│  AI Parser  │
│  Received   │     │   Handler    │     │   (Groq)    │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Confidence > 90%?    │
        └───────────┬───────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
   ┌──────────┐         ┌──────────────┐
   │   Auto   │         │   Queue for  │
   │  Create  │         │    Review    │
   └────┬─────┘         └──────┬───────┘
        │                      │
        ▼                      ▼
   ┌──────────┐         ┌──────────────┐
   │  Update  │         │   Notify     │
   │  Balance │         │    User      │
   └──────────┘         └──────────────┘
```

### Frontend Components for Email

**Files to create:**
- `frontend/src/pages/EmailImport.tsx`
- `frontend/src/components/features/Email/EmailImportList.tsx`
- `frontend/src/components/features/Email/EmailReviewModal.tsx`
- `frontend/src/components/features/Email/ConnectEmailModal.tsx`
- `frontend/src/components/features/Email/EmailAddress.tsx`

**UI Features:**
- Show unique forwarding email address (copy button)
- List of imported emails with status
- Review queue for low-confidence imports
- Edit extracted data before approval
- Connect Gmail/Outlook buttons
- Sync status and history

### AI Prompt for Email Parsing

```
System: You are a financial transaction parser. Extract transaction details from emails.

User: Parse this email and extract transaction details:
From: alerts@chase.com
Subject: Transaction Alert
Body: "Your Chase card ending in 4532 was used for $127.50 at WHOLE FOODS MARKET #10847 on 01/15/2024."

Return JSON:
{
  "amount": number,
  "currency": "USD" | "EUR" | etc,
  "type": "income" | "expense",
  "description": string,
  "category": string (from: Food & Dining, Shopping, Transport, Bills, Health, Entertainment, Travel, Income, Other),
  "date": "YYYY-MM-DD",
  "merchant": string or null,
  "confidence": 0.0-1.0,
  "notes": any additional context
}
```

### Email Provider Integration

**Option 1: Email Forwarding (Simple)**
- Each user gets unique address: `user123@tx.yourapp.com`
- User forwards bank emails to this address
- Webhook receives and processes

**Option 2: Gmail API (Automatic)**
- User connects Gmail account
- App reads emails with specific labels/filters
- Auto-import matching emails

**Option 3: IMAP (Universal)**
- User provides IMAP credentials
- App periodically checks for new emails
- Works with any email provider

---

## Phase 1: User Authentication & Database Foundation

### 1.1 Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_currency VARCHAR(3) DEFAULT 'USD',
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories (system + user-defined)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    type VARCHAR(10) CHECK (type IN ('income', 'expense')),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description TEXT,
    notes TEXT,
    date DATE NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_interval VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    period VARCHAR(10) CHECK (period IN ('weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Savings Goals
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    target_amount DECIMAL(15, 2) NOT NULL,
    current_amount DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(3) NOT NULL,
    deadline DATE,
    icon VARCHAR(50) DEFAULT 'target',
    color VARCHAR(7) DEFAULT '#10b981',
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Goal contributions (track deposits toward goals)
CREATE TABLE goal_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    note TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_goals_user ON goals(user_id);
```

### 1.2 Backend - Auth System

**Files to create:**
- `backend/internal/auth/jwt.go` - JWT token generation/validation
- `backend/internal/auth/middleware.go` - Auth middleware for protected routes
- `backend/internal/auth/handlers.go` - Login, signup, logout, refresh handlers
- `backend/internal/models/user.go` - User model and validation

**API Endpoints:**
```
POST /api/auth/signup     - Create new account
POST /api/auth/login      - Login and get tokens
POST /api/auth/logout     - Invalidate refresh token
POST /api/auth/refresh    - Refresh access token
GET  /api/auth/me         - Get current user profile
PUT  /api/auth/me         - Update user profile
PUT  /api/auth/password   - Change password
```

**Dependencies to add:**
```go
golang.org/x/crypto/bcrypt  // Password hashing
github.com/golang-jwt/jwt/v5  // JWT tokens
```

### 1.3 Frontend - Auth Pages

**Files to create:**
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Signup.tsx`
- `frontend/src/pages/ForgotPassword.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/hooks/useAuth.ts`

**Features:**
- Login form with email/password
- Signup form with validation
- Password reset flow
- Remember me functionality
- JWT storage and refresh
- Protected route wrapper

---

## Phase 2: Transaction Management

### 2.1 Backend - Transaction API

**Files to create:**
- `backend/internal/models/transaction.go`
- `backend/internal/repository/transaction_db.go`
- `backend/internal/handlers/transaction.go`

**API Endpoints:**
```
GET    /api/transactions           - List transactions (with filters)
GET    /api/transactions/:id       - Get single transaction
POST   /api/transactions           - Create transaction
PUT    /api/transactions/:id       - Update transaction
DELETE /api/transactions/:id       - Delete transaction
GET    /api/transactions/summary   - Get spending summary
GET    /api/transactions/export    - Export to CSV
```

**Query Parameters for listing:**
- `from` / `to` - Date range
- `type` - income/expense
- `category` - Filter by category
- `currency` - Filter by currency
- `search` - Search description
- `page` / `limit` - Pagination

### 2.2 Backend - Category API

**API Endpoints:**
```
GET    /api/categories        - List all categories
POST   /api/categories        - Create custom category
PUT    /api/categories/:id    - Update category
DELETE /api/categories/:id    - Delete category (only user-created)
```

**System Categories (pre-seeded):**
```
Income:
- Salary, Freelance, Investments, Gifts, Other Income

Expense:
- Food & Dining, Transportation, Shopping, Entertainment,
  Bills & Utilities, Health, Education, Travel, Other
```

### 2.3 Frontend - Transaction Components

**Files to create:**
- `frontend/src/pages/Transactions.tsx`
- `frontend/src/components/features/Transactions/TransactionList.tsx`
- `frontend/src/components/features/Transactions/TransactionCard.tsx`
- `frontend/src/components/features/Transactions/TransactionForm.tsx`
- `frontend/src/components/features/Transactions/TransactionFilters.tsx`
- `frontend/src/hooks/useTransactions.ts`

**Features:**
- List view with infinite scroll
- Filter by date, category, type
- Quick add transaction modal
- Edit/delete transactions
- Multi-currency display (convert to default currency)
- Search functionality

---

## Phase 3: Dashboard & Analytics

### 3.1 Backend - Analytics API

**API Endpoints:**
```
GET /api/analytics/overview         - Monthly overview
GET /api/analytics/spending         - Spending by category
GET /api/analytics/trends           - Income vs expense trends
GET /api/analytics/cashflow         - Cash flow projection
```

**Response Examples:**

```json
// GET /api/analytics/overview
{
  "period": "2024-01",
  "total_income": 5000.00,
  "total_expenses": 3200.00,
  "net_savings": 1800.00,
  "savings_rate": 36.0,
  "top_categories": [
    { "name": "Food", "amount": 800, "percentage": 25 }
  ]
}
```

### 3.2 Frontend - Dashboard

**Files to create:**
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/components/features/Dashboard/OverviewCards.tsx`
- `frontend/src/components/features/Dashboard/SpendingChart.tsx`
- `frontend/src/components/features/Dashboard/RecentTransactions.tsx`
- `frontend/src/components/features/Dashboard/BudgetProgress.tsx`
- `frontend/src/components/features/Dashboard/GoalProgress.tsx`

**Dashboard Sections:**
1. **Overview Cards** - Total income, expenses, savings, net worth
2. **Spending Chart** - Pie/donut chart by category
3. **Trend Chart** - Line chart of income vs expenses over time
4. **Recent Transactions** - Last 5-10 transactions
5. **Budget Alerts** - Categories approaching/over budget
6. **Goal Progress** - Visual progress toward savings goals

---

## Phase 4: Budget Management

### 4.1 Backend - Budget API

**API Endpoints:**
```
GET    /api/budgets           - List all budgets
GET    /api/budgets/:id       - Get budget with spending
POST   /api/budgets           - Create budget
PUT    /api/budgets/:id       - Update budget
DELETE /api/budgets/:id       - Delete budget
GET    /api/budgets/status    - All budgets with current spending
```

**Budget Status Response:**
```json
{
  "budgets": [
    {
      "id": "uuid",
      "category": "Food & Dining",
      "limit": 500.00,
      "spent": 350.00,
      "remaining": 150.00,
      "percentage": 70,
      "status": "on_track" // on_track, warning, exceeded
    }
  ]
}
```

### 4.2 Frontend - Budget Components

**Files to create:**
- `frontend/src/pages/Budgets.tsx`
- `frontend/src/components/features/Budgets/BudgetList.tsx`
- `frontend/src/components/features/Budgets/BudgetCard.tsx`
- `frontend/src/components/features/Budgets/BudgetForm.tsx`
- `frontend/src/components/features/Budgets/BudgetProgressBar.tsx`

**Features:**
- Visual budget progress bars
- Color coding (green/yellow/red)
- Monthly/weekly toggle
- Budget vs actual comparison
- Alerts when approaching limit

---

## Phase 5: Savings Goals

### 5.1 Backend - Goals API

**API Endpoints:**
```
GET    /api/goals              - List all goals
GET    /api/goals/:id          - Get goal with contributions
POST   /api/goals              - Create goal
PUT    /api/goals/:id          - Update goal
DELETE /api/goals/:id          - Delete goal
POST   /api/goals/:id/contribute - Add contribution
GET    /api/goals/:id/forecast  - AI prediction for completion
```

### 5.2 Frontend - Goals Components

**Files to create:**
- `frontend/src/pages/Goals.tsx`
- `frontend/src/components/features/Goals/GoalList.tsx`
- `frontend/src/components/features/Goals/GoalCard.tsx`
- `frontend/src/components/features/Goals/GoalForm.tsx`
- `frontend/src/components/features/Goals/ContributionModal.tsx`
- `frontend/src/components/features/Goals/GoalProgress.tsx`

**Features:**
- Visual progress toward goal
- Contribution history
- Deadline countdown
- Projected completion date
- Celebration animation on completion

---

## Phase 6: AI Features (Groq API)

### 6.1 Backend - AI Service with Groq

**Why Groq?**
- Free tier available
- Ultra-fast inference (fastest LLM API)
- Supports Llama 3, Mixtral, Gemma models
- OpenAI-compatible API format
- Great for real-time features

**Files to create:**
- `backend/internal/ai/groq_client.go` - Groq API client
- `backend/internal/ai/categorize.go` - Auto-categorization
- `backend/internal/ai/insights.go` - Spending insights
- `backend/internal/ai/chat.go` - Natural language queries
- `backend/internal/ai/forecast.go` - Predictions

**Groq Configuration:**
```go
// Groq API setup
const GroqAPIURL = "https://api.groq.com/openai/v1/chat/completions"

type GroqClient struct {
    APIKey string
    Model  string  // "llama-3.1-70b-versatile" or "mixtral-8x7b-32768"
}

// Models available (as of 2024):
// - llama-3.1-70b-versatile (best for complex tasks)
// - llama-3.1-8b-instant (fastest, good for categorization)
// - mixtral-8x7b-32768 (good balance)
// - gemma2-9b-it (lightweight)
```

**API Endpoints:**
```
POST /api/ai/categorize    - Auto-categorize transaction
POST /api/ai/insights      - Generate spending insights
POST /api/ai/chat          - Natural language query
POST /api/ai/forecast      - Cash flow prediction
```

### 6.2 AI Feature Details

**1. Smart Categorization**
```json
// Request
POST /api/ai/categorize
{ "description": "STARBUCKS #12345 NYC" }

// Response
{
  "category": "Food & Dining",
  "confidence": 0.95,
  "subcategory": "Coffee & Cafes"
}
```

**2. Spending Insights**
```json
// Request
POST /api/ai/insights
{ "period": "2024-01" }

// Response
{
  "insights": [
    {
      "type": "spending_increase",
      "message": "Your dining expenses increased 45% compared to last month",
      "category": "Food & Dining",
      "suggestion": "Consider meal prepping to reduce restaurant spending"
    },
    {
      "type": "saving_opportunity",
      "message": "You could save $200/month by reducing subscription services",
      "amount": 200
    }
  ]
}
```

**3. Natural Language Chat**
```json
// Request
POST /api/ai/chat
{ "message": "How much did I spend on groceries last month?" }

// Response
{
  "answer": "You spent $485.32 on groceries in January 2024. This is 12% less than December.",
  "data": {
    "amount": 485.32,
    "comparison": -12,
    "transactions_count": 8
  }
}
```

**4. Cash Flow Forecast**
```json
// Request
POST /api/ai/forecast
{ "months": 3 }

// Response
{
  "forecast": [
    { "month": "2024-02", "projected_income": 5000, "projected_expenses": 3100, "confidence": 0.85 },
    { "month": "2024-03", "projected_income": 5000, "projected_expenses": 3200, "confidence": 0.75 },
    { "month": "2024-04", "projected_income": 5000, "projected_expenses": 3150, "confidence": 0.65 }
  ],
  "insights": "Based on your patterns, you'll save approximately $5,550 over the next 3 months"
}
```

### 6.3 Frontend - AI Components

**Files to create:**
- `frontend/src/components/features/AI/AIChat.tsx`
- `frontend/src/components/features/AI/InsightsPanel.tsx`
- `frontend/src/components/features/AI/ForecastChart.tsx`
- `frontend/src/components/features/AI/SmartCategorySuggestion.tsx`

---

## Phase 7: Navigation & App Structure

### 7.1 App Navigation

**Sidebar Menu:**
```
- Dashboard (home icon)
- Transactions (list icon)
- Budgets (pie chart icon)
- Goals (target icon)
- Converter (currency icon) [existing feature]
- AI Assistant (sparkles icon)
- Settings (gear icon)
```

### 7.2 Frontend Router Setup

```tsx
// App routes
/                     -> Dashboard (protected)
/login               -> Login page
/signup              -> Signup page
/transactions        -> Transactions list (protected)
/transactions/new    -> Add transaction (protected)
/budgets             -> Budget management (protected)
/goals               -> Savings goals (protected)
/converter           -> Currency converter (existing, now protected)
/ai                  -> AI chat interface (protected)
/settings            -> User settings (protected)
```

---

## Phase 8: Settings & User Preferences

### 8.1 Settings Features

- **Profile**: Name, email, avatar
- **Preferences**: Default currency, date format, language
- **Notifications**: Budget alerts, goal reminders
- **Data**: Export data, import transactions
- **Security**: Change password, 2FA (future)
- **Appearance**: Theme (light/dark/system)

---

## Technical Considerations

### Environment Variables

```env
# Existing
DATABASE_URL=postgresql://...
FRANKFURTER_API_URL=https://api.frankfurter.app

# New - Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# New - AI (Groq - Free Tier)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-70b-versatile  # or llama-3.1-8b-instant for speed
```

### Security

- Password hashing with bcrypt (cost 12)
- JWT with short expiry + refresh tokens
- HTTPS only cookies for tokens
- Rate limiting on auth endpoints
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

### Performance

- Database indexes on frequently queried columns
- Pagination for transaction lists
- Caching for analytics (Redis future)
- Lazy loading for dashboard components

---

## Implementation Timeline

| Phase | Features | Estimated Effort |
|-------|----------|------------------|
| 1 | Auth + Database | Foundation |
| 2 | Transactions | Core feature |
| 3 | Dashboard | User value |
| 4 | Budgets | Planning |
| 5 | Goals | Motivation |
| 6 | AI Features | Differentiation |
| 7 | Navigation | Polish |
| 8 | Settings | Completeness |

---

## Next Steps

1. **Approve this plan** - Review and confirm the approach
2. **Start Phase 1** - Database schema + Auth system
3. **Iterate** - Build, test, refine each phase

Ready to begin implementation?
