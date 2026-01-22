# CoFinance - Free Features Implementation Plan

> **Objective**: Enhance CoFinance with high-impact features that require zero additional cost.
> 
> **Estimated Total Effort**: 4-6 weeks for all features
> 
> **Tech Stack**: Existing Go backend + React frontend + PostgreSQL + Groq AI (free tier)

---

## 📋 Feature Priority Matrix

| Priority | Feature | Effort | Impact | Dependencies |
|----------|---------|--------|--------|--------------|
| 🔴 P0 | Subscription Manager | 2-3 days | Very High | Recurring transactions |
| 🔴 P0 | Two-Factor Auth (TOTP) | 2-3 days | Very High | None |
| 🟡 P1 | AI Financial Advisor Chat | 3-4 days | High | Groq API |
| 🟡 P1 | Savings Challenges | 2-3 days | High | Goals system |
| 🟡 P1 | Achievement Badges | 2 days | High | None |
| 🟢 P2 | PDF Export | 1-2 days | Medium | None |
| 🟢 P2 | Privacy Mode | 0.5 days | Medium | None |
| 🟢 P2 | Financial Health Score | 1-2 days | Medium | Analytics |
| 🔵 P3 | Calendar View | 2-3 days | Medium | None |
| 🔵 P3 | Browser Push Notifications | 2-3 days | Medium | Service Worker |
| 🔵 P3 | Net Worth Calculator | 1-2 days | Medium | None |
| 🔵 P3 | Debt Payoff Planner | 2 days | Medium | None |
| ⚪ P4 | Sankey Diagram | 1-2 days | Low | D3.js |
| ⚪ P4 | More Languages | 2-3 days | Low | i18n |
| ⚪ P4 | High Contrast Mode | 0.5 days | Low | None |

---

## 🔴 Priority 0: Critical Features

### 1. Subscription Manager
**Effort**: 2-3 days | **Impact**: Very High

Track and manage recurring subscriptions with cost analysis.

#### Database Changes
```sql
-- Extend recurring_transactions table or create new view
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recurring_id UUID REFERENCES recurring_transactions(id),
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL, -- monthly, yearly, weekly
    next_billing_date DATE,
    category VARCHAR(50), -- streaming, software, gym, etc.
    status VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled
    reminder_days INTEGER DEFAULT 3, -- days before to remind
    notes TEXT,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date);
```

#### API Endpoints
```
GET    /api/subscriptions              - List all subscriptions
GET    /api/subscriptions/:id          - Get subscription details
POST   /api/subscriptions              - Create subscription
PUT    /api/subscriptions/:id          - Update subscription
DELETE /api/subscriptions/:id          - Cancel subscription
GET    /api/subscriptions/summary      - Total monthly/yearly cost
GET    /api/subscriptions/upcoming     - Upcoming renewals
POST   /api/subscriptions/from-recurring - Import from recurring transactions
```

#### Frontend Components
```
frontend/src/
├── pages/Subscriptions.tsx
└── components/features/Subscriptions/
    ├── SubscriptionList.tsx
    ├── SubscriptionCard.tsx
    ├── SubscriptionForm.tsx
    ├── SubscriptionSummary.tsx      # Total cost display
    ├── UpcomingRenewals.tsx
    └── ImportFromRecurring.tsx
```

#### Features
- [ ] List all active subscriptions with logos
- [ ] Show monthly/yearly total cost
- [ ] Upcoming renewal calendar
- [ ] Import from existing recurring transactions
- [ ] Cancel/pause functionality
- [ ] Reminder before renewal
- [ ] Category breakdown (streaming, software, etc.)

---

### 2. Two-Factor Authentication (TOTP)
**Effort**: 2-3 days | **Impact**: Very High

Secure accounts with Google Authenticator / Authy support.

#### Database Changes
```sql
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(32);
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN totp_backup_codes TEXT[]; -- Array of hashed backup codes

-- Track 2FA attempts
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN,
    failure_reason VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Backend Dependencies
```go
// go.mod
github.com/pquerna/otp v1.4.0  // TOTP library
```

#### API Endpoints
```
POST /api/auth/2fa/setup           - Generate TOTP secret & QR code
POST /api/auth/2fa/verify          - Verify code and enable 2FA
POST /api/auth/2fa/disable         - Disable 2FA (requires password)
GET  /api/auth/2fa/backup-codes    - Generate backup codes
POST /api/auth/login               - Modified to check 2FA
```

#### Frontend Components
```
frontend/src/
├── pages/Security.tsx              # 2FA settings page
└── components/features/Security/
    ├── TwoFactorSetup.tsx          # QR code & setup flow
    ├── TwoFactorVerify.tsx         # Code input modal
    ├── BackupCodes.tsx             # Display/regenerate codes
    └── LoginHistory.tsx            # Recent login attempts
```

#### Implementation Flow
```
1. User enables 2FA → Generate TOTP secret
2. Show QR code → User scans with authenticator app
3. User enters 6-digit code → Verify and enable
4. Generate 10 backup codes → User saves them
5. On login → After password, require 6-digit code
```

---

## 🟡 Priority 1: High-Impact Features

### 3. AI Financial Advisor Chat
**Effort**: 3-4 days | **Impact**: High

Chat interface to ask questions about your finances using Groq AI.

#### Database Changes
```sql
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
```

#### API Endpoints
```
GET    /api/ai/conversations          - List conversations
POST   /api/ai/conversations          - Start new conversation
GET    /api/ai/conversations/:id      - Get conversation messages
POST   /api/ai/chat                   - Send message, get AI response
DELETE /api/ai/conversations/:id      - Delete conversation
```

#### System Prompt Template
```
You are a helpful financial advisor for {user_name}. You have access to their financial data:

**Current Balance**: ${balance}
**This Month's Income**: ${income}
**This Month's Expenses**: ${expenses}
**Top Spending Categories**: {categories}
**Active Budgets**: {budgets}
**Savings Goals**: {goals}

Answer questions about their finances, provide insights, and suggest improvements.
Be specific with numbers and actionable advice.
```

#### Frontend Components
```
frontend/src/
├── pages/AIChat.tsx
└── components/features/AIChat/
    ├── ChatWindow.tsx
    ├── ChatMessage.tsx
    ├── ChatInput.tsx
    ├── ConversationList.tsx
    ├── SuggestedQuestions.tsx
    └── FinancialContext.tsx         # Shows data AI can see
```

#### Example Queries
- "How much did I spend on food this month?"
- "Am I on track to reach my vacation goal?"
- "What subscriptions should I cancel?"
- "How can I save $500 more per month?"
- "Compare my spending to last month"

---

### 4. Savings Challenges
**Effort**: 2-3 days | **Impact**: High

Gamified savings challenges to motivate users.

#### Database Changes
```sql
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(30) NOT NULL, -- '52_week', 'no_spend', 'round_up', 'custom'
    target_amount DECIMAL(15, 2),
    duration_days INTEGER,
    rules JSONB, -- Challenge-specific rules
    badge_icon VARCHAR(50),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, failed, abandoned
    current_progress DECIMAL(15, 2) DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE challenge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_challenge_id UUID NOT NULL REFERENCES user_challenges(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount DECIMAL(15, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pre-seed system challenges
INSERT INTO challenges (name, description, type, target_amount, duration_days, is_system) VALUES
('52-Week Savings', 'Save $1 week 1, $2 week 2... up to $52 in week 52', '52_week', 1378, 365, TRUE),
('No-Spend Weekend', 'Don''t spend anything for 2 days', 'no_spend', 0, 2, TRUE),
('No-Spend Week', 'Zero discretionary spending for 7 days', 'no_spend', 0, 7, TRUE),
('Coffee Challenge', 'Skip coffee shops for 30 days', 'no_spend', 0, 30, TRUE),
('Round-Up Challenge', 'Save the cents from every transaction', 'round_up', NULL, 30, TRUE),
('$1000 in 30 Days', 'Save $1000 in one month', 'custom', 1000, 30, TRUE);
```

#### API Endpoints
```
GET    /api/challenges                - List available challenges
GET    /api/challenges/active         - User's active challenges
POST   /api/challenges/:id/join       - Join a challenge
POST   /api/challenges/:id/entry      - Log challenge entry
PUT    /api/challenges/:id/abandon    - Give up challenge
GET    /api/challenges/:id/progress   - Get detailed progress
```

#### Frontend Components
```
frontend/src/
├── pages/Challenges.tsx
└── components/features/Challenges/
    ├── ChallengeList.tsx
    ├── ChallengeCard.tsx
    ├── ActiveChallenges.tsx
    ├── ChallengeProgress.tsx
    ├── WeekGrid.tsx                  # For 52-week challenge
    ├── StreakCounter.tsx
    └── ChallengeComplete.tsx         # Celebration modal
```

---

### 5. Achievement Badges
**Effort**: 2 days | **Impact**: High

Gamification through unlockable achievements.

#### Database Changes
```sql
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- savings, budgeting, streak, milestone
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value DECIMAL(15, 2),
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id),
    earned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- Pre-seed badges
INSERT INTO badges (name, description, icon, category, requirement_type, requirement_value, rarity) VALUES
-- Getting Started
('First Steps', 'Add your first transaction', '🎯', 'milestone', 'transaction_count', 1, 'common'),
('Budget Beginner', 'Create your first budget', '📊', 'budgeting', 'budget_count', 1, 'common'),
('Goal Setter', 'Set your first savings goal', '🎯', 'savings', 'goal_count', 1, 'common'),

-- Savings Milestones
('Century Saver', 'Save $100', '💯', 'savings', 'total_saved', 100, 'common'),
('Grand Saver', 'Save $1,000', '💰', 'savings', 'total_saved', 1000, 'rare'),
('Five Figure Club', 'Save $10,000', '🏆', 'savings', 'total_saved', 10000, 'epic'),
('Wealth Builder', 'Save $100,000', '👑', 'savings', 'total_saved', 100000, 'legendary'),

-- Streaks
('Week Warrior', '7-day tracking streak', '🔥', 'streak', 'streak_days', 7, 'common'),
('Month Master', '30-day tracking streak', '⚡', 'streak', 'streak_days', 30, 'rare'),
('Quarterly Champion', '90-day tracking streak', '🌟', 'streak', 'streak_days', 90, 'epic'),
('Year Legend', '365-day tracking streak', '🏅', 'streak', 'streak_days', 365, 'legendary'),

-- Budgeting
('Under Budget', 'Stay under budget for a month', '✅', 'budgeting', 'months_under_budget', 1, 'common'),
('Budget Pro', 'Stay under budget 3 months in a row', '📈', 'budgeting', 'months_under_budget', 3, 'rare'),

-- Special
('Night Owl', 'Add transaction after midnight', '🦉', 'special', 'special', NULL, 'common'),
('Early Bird', 'Add transaction before 6 AM', '🐦', 'special', 'special', NULL, 'common'),
('Globe Trotter', 'Use 5 different currencies', '🌍', 'special', 'currency_count', 5, 'rare'),
('AI Explorer', 'Use AI chat feature', '🤖', 'special', 'ai_usage', 1, 'common');
```

#### API Endpoints
```
GET  /api/badges                      - List all badges
GET  /api/badges/earned               - User's earned badges
GET  /api/badges/progress             - Progress toward next badges
POST /api/badges/check                - Check and award new badges
```

#### Frontend Components
```
frontend/src/
└── components/features/Badges/
    ├── BadgeGrid.tsx
    ├── BadgeCard.tsx
    ├── BadgeProgress.tsx
    ├── BadgeUnlockedModal.tsx        # Celebration when earned
    └── BadgeShowcase.tsx             # Display on profile
```

---

## 🟢 Priority 2: Nice-to-Have Features

### 6. PDF Export
**Effort**: 1-2 days | **Impact**: Medium

Generate beautiful PDF reports.

#### Dependencies
```json
// package.json
"@react-pdf/renderer": "^3.1.0"
// or
"jspdf": "^2.5.1",
"jspdf-autotable": "^3.8.0"
```

#### Features
- [ ] Monthly statement PDF
- [ ] Transaction history PDF
- [ ] Budget report PDF
- [ ] Goal progress PDF
- [ ] Annual summary PDF

---

### 7. Privacy Mode
**Effort**: 0.5 days | **Impact**: Medium

Hide sensitive financial information on screen.

#### Implementation
```typescript
// Add to AuthContext or create PrivacyContext
const [privacyMode, setPrivacyMode] = useState(false);

// CSS class for hidden amounts
.privacy-mode .amount {
  filter: blur(8px);
  user-select: none;
}
```

#### Features
- [ ] Toggle in header/settings
- [ ] Blur all monetary amounts
- [ ] Show/hide on hover
- [ ] Remember preference

---

### 8. Financial Health Score
**Effort**: 1-2 days | **Impact**: Medium

Calculate an overall financial health score (0-100).

#### Scoring Algorithm
```
Score Components:
├── Savings Rate (25%): % of income saved
├── Budget Adherence (25%): % of budgets met
├── Emergency Fund (20%): Months of expenses saved
├── Debt Ratio (15%): Debt payments vs income
├── Goal Progress (10%): Average goal completion
└── Consistency (5%): Transaction tracking streak

Grade Scale:
90-100: Excellent 🌟
80-89:  Great 💪
70-79:  Good 👍
60-69:  Fair 📊
Below 60: Needs Work 🎯
```

---

## 🔵 Priority 3: Enhancement Features

### 9. Calendar View
**Effort**: 2-3 days | **Impact**: Medium

View transactions on a calendar interface.

---

### 10. Browser Push Notifications
**Effort**: 2-3 days | **Impact**: Medium

Native browser notifications for alerts.

#### Notification Types
- Budget exceeded
- Bill reminder (3 days before)
- Goal milestone reached
- Weekly summary

---

### 11. Net Worth Calculator
**Effort**: 1-2 days | **Impact**: Medium

Track assets and liabilities.

#### Database Changes
```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50), -- cash, investment, property, vehicle, other
    value DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE liabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50), -- mortgage, car_loan, student_loan, credit_card, other
    amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2),
    currency VARCHAR(3) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 12. Debt Payoff Planner
**Effort**: 2 days | **Impact**: Medium

Calculate debt payoff strategies (Snowball vs Avalanche).

---

## ⚪ Priority 4: Polish Features

### 13. Sankey Diagram
**Effort**: 1-2 days | **Impact**: Low

Visualize money flow from income to expense categories.

#### Dependencies
```json
"d3": "^7.8.0",
"d3-sankey": "^0.12.3"
```

---

### 14. More Languages
**Effort**: 2-3 days | **Impact**: Low

Add Spanish, French, German, Chinese translations.

---

### 15. High Contrast Mode
**Effort**: 0.5 days | **Impact**: Low

Accessibility-focused high contrast theme.

---

## 📁 New File Structure

```
backend/
├── internal/
│   ├── handler/
│   │   ├── subscription.go       # NEW
│   │   ├── challenge.go          # NEW
│   │   ├── badge.go              # NEW
│   │   ├── asset.go              # NEW
│   │   └── ai_chat.go            # NEW
│   ├── repository/
│   │   ├── subscription_db.go    # NEW
│   │   ├── challenge_db.go       # NEW
│   │   ├── badge_db.go           # NEW
│   │   └── asset_db.go           # NEW
│   ├── service/
│   │   ├── totp.go               # NEW - 2FA
│   │   ├── badge_checker.go      # NEW
│   │   ├── health_score.go       # NEW
│   │   └── ai_advisor.go         # NEW
│   └── model/
│       ├── subscription.go       # NEW
│       ├── challenge.go          # NEW
│       ├── badge.go              # NEW
│       └── asset.go              # NEW

frontend/src/
├── pages/
│   ├── Subscriptions.tsx         # NEW
│   ├── Challenges.tsx            # NEW
│   ├── AIChat.tsx                # NEW
│   ├── Security.tsx              # NEW
│   └── NetWorth.tsx              # NEW
├── components/features/
│   ├── Subscriptions/            # NEW
│   ├── Challenges/               # NEW
│   ├── Badges/                   # NEW
│   ├── AIChat/                   # NEW
│   ├── Security/                 # NEW
│   └── NetWorth/                 # NEW
├── context/
│   └── PrivacyContext.tsx        # NEW
└── utils/
    ├── healthScore.ts            # NEW
    └── pdfGenerator.ts           # NEW
```

---

## 🚀 Implementation Order

### Sprint 1 (Week 1-2): Security & Foundation
- [ ] Two-Factor Authentication (TOTP)
- [ ] Privacy Mode
- [ ] Login History

### Sprint 2 (Week 2-3): Financial Tools
- [ ] Subscription Manager
- [ ] Net Worth Calculator
- [ ] Financial Health Score

### Sprint 3 (Week 3-4): Gamification
- [ ] Achievement Badges
- [ ] Savings Challenges
- [ ] Streak Tracking

### Sprint 4 (Week 4-5): AI & Insights
- [ ] AI Financial Advisor Chat
- [ ] Smart Insights
- [ ] Spending Predictions

### Sprint 5 (Week 5-6): Polish
- [ ] PDF Export
- [ ] Calendar View
- [ ] Push Notifications
- [ ] Sankey Diagram

---

## ✅ Definition of Done

For each feature:
- [ ] Backend API implemented and tested
- [ ] Frontend UI completed with responsive design
- [ ] Dark mode supported
- [ ] RTL (Arabic/Persian) supported
- [ ] Loading and error states handled
- [ ] Documentation updated
- [ ] Deployed to production

---

## 📊 Success Metrics

| Feature | Metric | Target |
|---------|--------|--------|
| 2FA | Adoption rate | >30% of users |
| AI Chat | Messages per user | >5 avg |
| Challenges | Completion rate | >40% |
| Badges | Badges earned | >3 per user avg |
| Subscriptions | Subscriptions tracked | >5 per user avg |

---

*Last Updated: January 22, 2026*
