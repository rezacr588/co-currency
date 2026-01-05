# Personal Finance App - Implementation Plan

## Overview

Transform the currency converter into a full-featured personal finance application with AI-powered insights, multi-currency support, and comprehensive budget management.

**Tech Stack:**
- **Backend**: Go with Chi router, pgx/v5 PostgreSQL driver
- **Frontend**: React + TypeScript + TailwindCSS
- **Database**: PostgreSQL (Neon)
- **AI**: Groq API (free tier) - LLM inference only, no document ingestion
- **OCR**: Tesseract (self-hosted), pdfplumber for PDFs
- **Deployment**: Koyeb

---

## Complete Database Schema

All tables consolidated into a single, unified schema:

```sql
-- ============================================
-- CORE TABLES
-- ============================================

-- Users table (with balance tracking)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_currency VARCHAR(3) DEFAULT 'USD',
    avatar_url TEXT,
    current_balance DECIMAL(15, 2) DEFAULT 0,      -- Running balance
    balance_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories (system + user-defined)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for system categories
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    type VARCHAR(10) CHECK (type IN ('income', 'expense')),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions (with smart features & soft delete)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Core fields
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description TEXT,
    notes TEXT,
    date DATE NOT NULL,
    type VARCHAR(10) CHECK (type IN ('income', 'expense')),

    -- Smart currency conversion
    amount_base_currency DECIMAL(15, 2),           -- Converted to user's default currency
    exchange_rate DECIMAL(15, 8),                  -- Rate used at transaction time

    -- AI detection
    ai_detected_type VARCHAR(10),                  -- AI-suggested type
    ai_confidence DECIMAL(3, 2),                   -- Confidence score (0.00-1.00)

    -- Recurring transactions
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_interval VARCHAR(20),                -- daily, weekly, monthly, yearly

    -- Soft delete support
    deleted_at TIMESTAMP,
    deleted_by UUID REFERENCES users(id),

    -- Source tracking
    source VARCHAR(20) DEFAULT 'manual',           -- manual, email, document, api
    source_id UUID,                                -- Reference to email_imports or document_uploads

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

-- Goal contributions
CREATE TABLE goal_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    note TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- HISTORY & AUDIT TABLES
-- ============================================

-- Transaction Audit Log (immutable history)
CREATE TABLE transaction_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(10) CHECK (action IN ('create', 'update', 'delete')),
    old_values JSONB,                              -- Previous state (null for create)
    new_values JSONB,                              -- New state (null for delete)
    changed_fields TEXT[],                         -- List of fields that changed
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
    category_breakdown JSONB,                      -- { "Food": 500, "Transport": 200, ... }
    transaction_count INTEGER,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, year, month)
);

-- ============================================
-- EMAIL IMPORT TABLES
-- ============================================

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
    email_address VARCHAR(255) UNIQUE NOT NULL,    -- user123@tx.yourapp.com
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

-- ============================================
-- DOCUMENT UPLOAD TABLES
-- ============================================

-- Uploaded documents (receipts, statements)
CREATE TABLE document_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,                -- 'pdf', 'image/jpeg', etc.
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,                    -- S3/local path
    extracted_text TEXT,
    parsed_data JSONB,
    status VARCHAR(20) CHECK (status IN ('uploading', 'processing', 'parsed', 'failed', 'needs_review')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Link documents to transactions
CREATE TABLE document_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES document_uploads(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Core indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_deleted ON transactions(user_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_goals_user ON goals(user_id);

-- History indexes
CREATE INDEX idx_audit_log_transaction ON transaction_audit_log(transaction_id);
CREATE INDEX idx_audit_log_user_date ON transaction_audit_log(user_id, created_at);
CREATE INDEX idx_balance_snapshots_user_date ON balance_snapshots(user_id, snapshot_date);
CREATE INDEX idx_monthly_summaries_user ON monthly_summaries(user_id, year, month);

-- Email & document indexes
CREATE INDEX idx_email_imports_user ON email_imports(user_id, created_at);
CREATE INDEX idx_email_imports_status ON email_imports(status);
CREATE INDEX idx_documents_user ON document_uploads(user_id, created_at);
CREATE INDEX idx_documents_status ON document_uploads(status);
```

---

## Complete API Endpoints

All endpoints organized by feature:

### Authentication
```
POST /api/auth/signup           - Create new account
POST /api/auth/login            - Login and get tokens
POST /api/auth/logout           - Invalidate refresh token
POST /api/auth/refresh          - Refresh access token
GET  /api/auth/me               - Get current user profile
PUT  /api/auth/me               - Update user profile
PUT  /api/auth/password         - Change password
```

### Transactions
```
GET    /api/transactions        - List transactions (with filters, pagination)
GET    /api/transactions/:id    - Get single transaction
POST   /api/transactions        - Create transaction
PUT    /api/transactions/:id    - Update transaction
DELETE /api/transactions/:id    - Soft delete transaction
GET    /api/transactions/summary - Get spending summary
GET    /api/transactions/export - Export to CSV
```

### Categories
```
GET    /api/categories          - List all categories (system + user)
POST   /api/categories          - Create custom category
PUT    /api/categories/:id      - Update category
DELETE /api/categories/:id      - Delete category (user-created only)
```

### Budgets
```
GET    /api/budgets             - List all budgets
GET    /api/budgets/:id         - Get budget with spending
POST   /api/budgets             - Create budget
PUT    /api/budgets/:id         - Update budget
DELETE /api/budgets/:id         - Delete budget
GET    /api/budgets/status      - All budgets with current spending
```

### Goals
```
GET    /api/goals               - List all goals
GET    /api/goals/:id           - Get goal with contributions
POST   /api/goals               - Create goal
PUT    /api/goals/:id           - Update goal
DELETE /api/goals/:id           - Delete goal
POST   /api/goals/:id/contribute - Add contribution
GET    /api/goals/:id/forecast  - AI prediction for completion
```

### Analytics
```
GET /api/analytics/overview     - Monthly overview
GET /api/analytics/spending     - Spending by category
GET /api/analytics/trends       - Income vs expense trends
GET /api/analytics/cashflow     - Cash flow projection
```

### History
```
GET  /api/history/timeline      - Activity timeline with pagination
GET  /api/history/balance       - Balance history over time
GET  /api/history/audit/:id     - Audit log for specific transaction
GET  /api/history/snapshots     - Balance snapshots (daily/monthly)
GET  /api/history/summaries     - Monthly/yearly summaries
GET  /api/history/search        - Full-text search across transactions
GET  /api/history/export        - Export history to CSV/PDF
POST /api/history/restore/:id   - Restore soft-deleted transaction
```

### Email Import
```
POST /api/email/webhook         - Receive forwarded emails (webhook)
GET  /api/email/imports         - List imported emails
GET  /api/email/imports/:id     - Get import details
POST /api/email/imports/:id/approve - Approve pending import
POST /api/email/imports/:id/reject  - Reject import
GET  /api/email/address         - Get user's unique email address
POST /api/email/connect/gmail   - Connect Gmail account
POST /api/email/connect/outlook - Connect Outlook account
DELETE /api/email/disconnect/:id - Disconnect email account
POST /api/email/sync            - Manually trigger sync
```

### Document Processing
```
POST   /api/documents/upload    - Upload document (PDF/image)
GET    /api/documents           - List uploaded documents
GET    /api/documents/:id       - Get document details + extracted data
POST   /api/documents/:id/reprocess - Re-run OCR/parsing
DELETE /api/documents/:id       - Delete document
GET    /api/documents/:id/preview - Get document preview image
```

### AI Features
```
POST /api/ai/categorize         - Auto-categorize transaction
POST /api/ai/insights           - Generate spending insights
POST /api/ai/chat               - Natural language query
POST /api/ai/forecast           - Cash flow prediction
POST /api/ai/parse-receipt      - Parse extracted text from receipt
POST /api/ai/parse-email        - Parse email content for transaction
```

---

## Smart Features

### 1. Auto-detect Income vs Expense (AI-powered)

AI analyzes transaction description to determine type:
- "Salary from Company X" → Automatically marked as Income
- "Amazon.com purchase" → Automatically marked as Expense
- "Transfer from John" → AI suggests Income (user can override)
- Confidence score shown, user can always correct

### 2. Running Balance Tracking

- Each user has a real-time balance in their base currency
- Income transactions → ADD to balance
- Expense transactions → SUBTRACT from balance
- Balance history tracked over time via `balance_snapshots` table
- Dashboard shows current balance prominently

### 3. Automatic Currency Conversion

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

### 4. Email Import

Automatically import transactions from emails:

**Supported Email Types:**
| Email Type | Example | Extracted Data |
|------------|---------|----------------|
| Bank alerts | "You spent $50.00 at Amazon" | Amount, merchant, type |
| Receipts | "Your Uber receipt - $25.50" | Amount, category, date |
| Invoices | "Invoice #123 - $500 paid" | Amount, description |
| Salary | "Payroll deposit: $3,500" | Amount, income type |
| Subscriptions | "Netflix charged $15.99" | Amount, recurring flag |
| Transfers | "You received $100 from John" | Amount, sender, income |

**Integration Options:**
1. **Email Forwarding** - User gets unique address: `user123@tx.yourapp.com`
2. **Gmail API** - Auto-import from connected Gmail account
3. **IMAP** - Works with any email provider

### 5. Document & Receipt Scanning

**Important: Groq API does NOT have native document ingestion.** Pipeline:

```
Document Upload → Text Extraction (External) → AI Parsing (Groq) → Transaction Created
```

**Processing Tools:**
- **Tesseract** - OCR for images (free, self-hosted)
- **pdfplumber** - PDF text extraction (open source)
- **Groq** - AI parsing of extracted text (free tier)

**Supported Documents:**
- Receipt photos
- Bank statements (PDF)
- Invoices
- Credit card statements
- Scanned receipts

---

## Implementation Phases

### Phase 1: User Authentication & Database Foundation

**Backend Files:**
- `backend/internal/auth/jwt.go` - JWT token generation/validation
- `backend/internal/auth/middleware.go` - Auth middleware
- `backend/internal/auth/handlers.go` - Login, signup, logout, refresh
- `backend/internal/models/user.go` - User model
- `backend/internal/repository/user_db.go` - User repository

**Frontend Files:**
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Signup.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/hooks/useAuth.ts`

**Dependencies:**
```go
golang.org/x/crypto/bcrypt     // Password hashing
github.com/golang-jwt/jwt/v5   // JWT tokens
```

---

### Phase 2: Transaction Management

**Backend Files:**
- `backend/internal/models/transaction.go`
- `backend/internal/models/category.go`
- `backend/internal/repository/transaction_db.go`
- `backend/internal/repository/category_db.go`
- `backend/internal/handlers/transaction.go`
- `backend/internal/handlers/category.go`
- `backend/internal/services/currency_converter.go` - Auto-conversion

**Frontend Files:**
- `frontend/src/pages/Transactions.tsx`
- `frontend/src/components/features/Transactions/TransactionList.tsx`
- `frontend/src/components/features/Transactions/TransactionCard.tsx`
- `frontend/src/components/features/Transactions/TransactionForm.tsx`
- `frontend/src/components/features/Transactions/TransactionFilters.tsx`
- `frontend/src/hooks/useTransactions.ts`

**System Categories (pre-seeded):**
```
Income: Salary, Freelance, Investments, Gifts, Other Income
Expense: Food & Dining, Transportation, Shopping, Entertainment,
         Bills & Utilities, Health, Education, Travel, Other
```

---

### Phase 3: Dashboard & Analytics

**Backend Files:**
- `backend/internal/handlers/analytics.go`
- `backend/internal/services/analytics.go`

**Frontend Files:**
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/components/features/Dashboard/OverviewCards.tsx`
- `frontend/src/components/features/Dashboard/SpendingChart.tsx`
- `frontend/src/components/features/Dashboard/RecentTransactions.tsx`
- `frontend/src/components/features/Dashboard/BudgetProgress.tsx`
- `frontend/src/components/features/Dashboard/GoalProgress.tsx`
- `frontend/src/components/features/Dashboard/BalanceDisplay.tsx`

**Dashboard Sections:**
1. Current Balance (prominent display)
2. Overview Cards - Total income, expenses, savings
3. Spending Chart - Pie/donut chart by category
4. Trend Chart - Line chart of income vs expenses over time
5. Recent Transactions - Last 5-10 transactions
6. Budget Alerts - Categories approaching/over budget
7. Goal Progress - Visual progress toward savings goals

---

### Phase 4: Budget Management

**Backend Files:**
- `backend/internal/models/budget.go`
- `backend/internal/repository/budget_db.go`
- `backend/internal/handlers/budget.go`

**Frontend Files:**
- `frontend/src/pages/Budgets.tsx`
- `frontend/src/components/features/Budgets/BudgetList.tsx`
- `frontend/src/components/features/Budgets/BudgetCard.tsx`
- `frontend/src/components/features/Budgets/BudgetForm.tsx`
- `frontend/src/components/features/Budgets/BudgetProgressBar.tsx`

---

### Phase 5: Savings Goals

**Backend Files:**
- `backend/internal/models/goal.go`
- `backend/internal/repository/goal_db.go`
- `backend/internal/handlers/goal.go`

**Frontend Files:**
- `frontend/src/pages/Goals.tsx`
- `frontend/src/components/features/Goals/GoalList.tsx`
- `frontend/src/components/features/Goals/GoalCard.tsx`
- `frontend/src/components/features/Goals/GoalForm.tsx`
- `frontend/src/components/features/Goals/ContributionModal.tsx`
- `frontend/src/components/features/Goals/GoalProgress.tsx`

---

### Phase 6: AI Features (Groq API)

**Why Groq:**
- Free tier available (14,400 requests/day)
- Ultra-fast inference (fastest LLM API)
- Supports Llama 3.1, Mixtral, Gemma models
- OpenAI-compatible API format

**Backend Files:**
- `backend/internal/ai/groq_client.go` - Groq API client
- `backend/internal/ai/categorize.go` - Auto-categorization
- `backend/internal/ai/insights.go` - Spending insights
- `backend/internal/ai/chat.go` - Natural language queries
- `backend/internal/ai/forecast.go` - Predictions
- `backend/internal/ai/parse_transaction.go` - Parse emails/receipts

**Frontend Files:**
- `frontend/src/components/features/AI/AIChat.tsx`
- `frontend/src/components/features/AI/InsightsPanel.tsx`
- `frontend/src/components/features/AI/ForecastChart.tsx`
- `frontend/src/components/features/AI/SmartCategorySuggestion.tsx`

**Groq Configuration:**
```go
const GroqAPIURL = "https://api.groq.com/openai/v1/chat/completions"

// Recommended models:
// - llama-3.1-70b-versatile (best for complex tasks)
// - llama-3.1-8b-instant (fastest, good for categorization)
// - mixtral-8x7b-32768 (good balance)
```

---

### Phase 7: History & Audit Trail

**Backend Files:**
- `backend/internal/models/audit.go`
- `backend/internal/repository/audit_db.go`
- `backend/internal/handlers/history.go`
- `backend/internal/services/snapshot.go` - Balance snapshots

**Frontend Files:**
- `frontend/src/pages/History.tsx`
- `frontend/src/components/features/History/Timeline.tsx`
- `frontend/src/components/features/History/TimelineItem.tsx`
- `frontend/src/components/features/History/BalanceChart.tsx`
- `frontend/src/components/features/History/MonthlySummary.tsx`
- `frontend/src/components/features/History/SearchHistory.tsx`
- `frontend/src/components/features/History/AuditLog.tsx`
- `frontend/src/hooks/useHistory.ts`

**Background Jobs:**
- Daily: Create balance snapshots at midnight
- Monthly: Generate monthly summary on 1st of month
- Weekly: Clean up old audit logs (keep 2 years)

---

### Phase 8: Email Import & Document Scanning

**Backend Files:**
- `backend/internal/handlers/email.go`
- `backend/internal/handlers/document.go`
- `backend/internal/services/email_parser.go`
- `backend/internal/services/ocr.go` - Tesseract wrapper
- `backend/internal/services/pdf_parser.go` - PDF text extraction

**Frontend Files:**
- `frontend/src/pages/EmailImport.tsx`
- `frontend/src/components/features/Email/EmailImportList.tsx`
- `frontend/src/components/features/Email/EmailReviewModal.tsx`
- `frontend/src/components/features/Email/ConnectEmailModal.tsx`
- `frontend/src/components/features/Documents/DocumentUpload.tsx`
- `frontend/src/components/features/Documents/DocumentList.tsx`
- `frontend/src/components/features/Documents/ExtractedDataReview.tsx`

**Dependencies:**
```go
github.com/otiai10/gosseract    // Go wrapper for Tesseract OCR
github.com/ledongthuc/pdf       // PDF text extraction
```

---

### Phase 9: Navigation & Settings

**Frontend Files:**
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/pages/Settings.tsx`

**Routes:**
```
/                     -> Dashboard (protected)
/login               -> Login page
/signup              -> Signup page
/transactions        -> Transactions list (protected)
/transactions/new    -> Add transaction (protected)
/budgets             -> Budget management (protected)
/goals               -> Savings goals (protected)
/converter           -> Currency converter (existing, now protected)
/history             -> Transaction history (protected)
/ai                  -> AI chat interface (protected)
/settings            -> User settings (protected)
```

**Settings Features:**
- Profile: Name, email, avatar
- Preferences: Default currency, date format, language
- Notifications: Budget alerts, goal reminders
- Data: Export data, import transactions
- Security: Change password
- Appearance: Theme (light/dark/system)

---

## Environment Variables

```env
# Existing
DATABASE_URL=postgresql://...
FRANKFURTER_API_URL=https://api.frankfurter.app

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# AI (Groq - Free Tier)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-70b-versatile

# Email (optional)
EMAIL_WEBHOOK_SECRET=your-webhook-secret

# Storage (for documents)
STORAGE_PATH=/uploads
# Or S3:
# AWS_S3_BUCKET=your-bucket
# AWS_REGION=us-east-1
```

---

## Security Considerations

- Password hashing with bcrypt (cost 12)
- JWT with short expiry (15m) + refresh tokens (7d)
- HTTPS only cookies for tokens
- Rate limiting on auth endpoints
- Input validation and sanitization
- SQL injection prevention (parameterized queries via pgx)
- Soft deletes for data recovery
- Audit logging for accountability

---

## Cost Summary (Free Tier Stack)

| Service | Cost | Limits |
|---------|------|--------|
| Groq API | Free | 14,400 requests/day |
| Tesseract OCR | Free | Self-hosted |
| pdfplumber | Free | Open source |
| Neon PostgreSQL | Free | 0.5GB storage, 1 compute |
| Koyeb | Free | 1 app, limited hours |

---

## Next Steps

1. **Approve this plan** - Review and confirm the approach
2. **Start Phase 1** - Database migrations + Auth system
3. **Iterate** - Build, test, refine each phase

Ready to begin implementation?
