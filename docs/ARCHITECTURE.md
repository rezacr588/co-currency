# CoFinance Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├───────────────────┬───────────────────┬─────────────────────────────────────┤
│   Web (React)     │  Mobile (Expo)    │   Web PWA                           │
│   Port: 5173      │  iOS/Android      │   Installable                       │
│   Vite + React    │  React Native     │   Offline Support                   │
└─────────┬─────────┴─────────┬─────────┴──────────────┬──────────────────────┘
          │                   │                        │
          └───────────────────┼────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GO BACKEND                                         │
│                         (Single Binary)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Handlers   │  │   Services   │  │ Repositories │  │  Middleware  │    │
│  │  (HTTP API)  │◄─┤(Business     │◄─┤ (Data        │  │  (Auth/CORS) │    │
│  │              │  │ Logic)       │  │ Access)      │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Embedded Static Files (React Build)                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │                   │                        │
          ▼                   ▼                        ▼
┌─────────────────┐  ┌─────────────────┐      ┌─────────────────┐
│   PostgreSQL    │  │   Qdrant        │      │  External APIs  │
│   (Neon)        │  │   (Vector DB)   │      │  - ECB Rates    │
│   - Users       │  │   - Embeddings  │      │  - AI Providers │
│   - Transactions│  │   - Memories    │      │  - OAuth        │
│   - Goals       │  │                 │      │                 │
│   - Budgets     │  │                 │      │                 │
└─────────────────┘  └─────────────────┘      └─────────────────┘
```

## Directory Structure

```
co-currency/
├── backend/                 # Go Backend
│   ├── cmd/api/            # Application entry point
│   │   ├── main.go         # Server initialization
│   │   └── static/         # Embedded React build
│   ├── internal/
│   │   ├── handler/        # HTTP request handlers
│   │   ├── service/        # Business logic layer
│   │   ├── repository/     # Data access layer
│   │   ├── model/          # Domain models
│   │   ├── middleware/     # Auth, CORS, rate limiting
│   │   └── router/         # Route definitions
│   └── pkg/                # Shared utilities
│
├── frontend/               # React Web Application
│   └── src/
│       ├── api/            # API client
│       ├── components/     # UI components
│       │   ├── ui/         # Design system
│       │   ├── features/   # Feature components
│       │   └── layout/     # Layout components
│       ├── context/        # React Context providers
│       ├── hooks/          # Custom hooks
│       ├── pages/          # Route pages
│       └── types/          # TypeScript definitions
│
├── app/                    # Expo Mobile Application
│   ├── app/                # File-based routing
│   │   ├── (public)/       # Public screens
│   │   ├── (auth)/         # Auth screens
│   │   └── (app)/          # Protected screens
│   │       └── (tabs)/     # Tab navigation
│   └── src/
│       ├── api/            # API client
│       ├── components/     # Shared components
│       ├── context/        # Context providers
│       └── hooks/          # Custom hooks
│
└── docs/                   # Documentation
```

## Technology Stack

### Backend (Go)
- **Framework**: Chi Router
- **Database**: PostgreSQL (Neon) with pgxpool
- **Authentication**: JWT (access + refresh tokens)
- **Caching**: go-cache (in-memory)
- **Vector DB**: Qdrant (optional, for AI memory)

### Frontend (React)
- **Build Tool**: Vite
- **State Management**: TanStack Query
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **PWA**: vite-plugin-pwa

### Mobile (React Native)
- **Framework**: Expo (SDK 52)
- **Routing**: Expo Router (file-based)
- **Styling**: NativeWind (Tailwind)
- **Storage**: Expo SecureStore
- **Updates**: EAS Update (OTA)

## Core Features

### 1. Authentication
- JWT-based authentication
- Access tokens (15 min) + Refresh tokens (7 days)
- OAuth support (Google, LinkedIn)
- Password reset flow

### 2. Multi-Currency Wallet
- Track balances in any currency
- Real-time currency conversion
- Transaction history with categories
- Cross-currency transactions

### 3. Financial Goals
- Set savings targets
- Track progress with contributions
- Category-based organization
- Deadline tracking

### 4. Budgets
- Category-based spending limits
- Period tracking (weekly/monthly)
- Spending alerts

### 5. AI Financial Advisor
- Powered by Cerebras/OpenAI/GoogleAI
- User context awareness
- Long-term memory (PostgreSQL + Qdrant)
- Receipt parsing

### 6. Reports & Analytics
- Monthly summaries
- Category breakdowns
- Spending trends
- Net worth tracking
- Forecasting

## Data Flow

### Authentication Flow
```
Client → POST /api/v1/auth/login → Validate credentials
                                 → Generate JWT tokens
                                 → Store refresh token hash
                                 → Return tokens + user
```

### Transaction Flow
```
Client → POST /api/v1/wallet/transaction
       → Handler validates request
       → Service checks balance
       → Repository executes atomic transaction
         ├── Update balance
         └── Create transaction record
       → Return transaction
```

### AI Chat Flow
```
Client → POST /api/v1/ai/chat
       → Build context (balances, goals, budgets, transactions)
       → Retrieve relevant memories (Qdrant semantic search)
       → Send to AI provider with system prompt
       → Store AI response as memory
       → Return response
```

## Database Schema

### Core Tables
- `users` - User accounts
- `wallet_balances` - Currency balances per user
- `transactions` - All financial transactions
- `categories` - User-defined categories
- `goals` - Savings goals
- `budgets` - Spending budgets
- `recurring_transactions` - Scheduled transactions

### AI/Chat Tables
- `chat_conversations` - Chat threads
- `chat_messages` - Individual messages
- `user_memories` - AI long-term memory

### Auth Tables
- `refresh_tokens` - Active refresh tokens
- `oauth_states` - OAuth flow state

## API Structure

All API endpoints follow RESTful conventions:

| Category | Prefix | Auth Required |
|----------|--------|---------------|
| Public | `/api/v1/currencies`, `/api/v1/rates` | No |
| Auth | `/api/v1/auth/*` | Partial |
| Wallet | `/api/v1/wallet/*` | Yes |
| Goals | `/api/v1/goals/*` | Yes |
| Budgets | `/api/v1/budgets/*` | Yes |
| Reports | `/api/v1/reports/*` | Yes |
| AI | `/api/v1/ai/*` | Yes |

## Deployment

### Production
- **Platform**: Koyeb
- **Container**: Single Docker image with embedded frontend
- **Database**: Neon PostgreSQL
- **CDN**: Built into Koyeb

### Mobile Updates
- **OTA Updates**: EAS Update (no app store review)
- **Native Builds**: EAS Build (when native changes)
- **Branches**: production, preview, development

## Security

1. **Authentication**: JWT with short-lived access tokens
2. **Password**: bcrypt hashing
3. **Rate Limiting**: Per-user request limits
4. **CORS**: Configured for specific origins
5. **Input Validation**: Server-side validation
6. **SQL Injection**: Parameterized queries (pgx)
7. **XSS**: React's built-in escaping
