# Personal Finance App - Implementation Plan

## Overview

Transform the currency converter into a full-featured personal finance application with AI-powered insights, multi-currency support, and comprehensive budget management.

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

## Phase 6: AI Features

### 6.1 Backend - AI Service

**Files to create:**
- `backend/internal/ai/client.go` - Claude API client
- `backend/internal/ai/categorize.go` - Auto-categorization
- `backend/internal/ai/insights.go` - Spending insights
- `backend/internal/ai/chat.go` - Natural language queries
- `backend/internal/ai/forecast.go` - Predictions

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

# New
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
ANTHROPIC_API_KEY=sk-ant-...
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
