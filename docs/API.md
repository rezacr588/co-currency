# CoFinance API Documentation

This document describes all available API endpoints for the CoFinance currency converter application.

## Base URL

- Development: `http://localhost:8080/api/v1`
- Production: `https://your-app.koyeb.app/api/v1`

## Authentication

Protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained through the `/auth/login` or `/auth/register` endpoints:
- **Access Token**: Valid for 15 minutes
- **Refresh Token**: Valid for 7 days (use `/auth/refresh` to get new access token)

## Rate Limiting

All API endpoints (except `/health`) are rate-limited to prevent abuse:

- **Anonymous Users**: 30 requests per minute per IP
- **Authenticated Users**: 100 requests per minute per IP
- **Login Attempts**: 5 attempts per minute per IP
- **Burst Allowance**: 10% of the limit

When rate limited, the API returns:

```json
{
  "error": "rate_limit_exceeded",
  "code": 429,
  "message": "Rate limit exceeded. Please try again later."
}
```

## Response Format

### Success Response

```json
{
  "field1": "value1",
  "field2": "value2"
}
```

### Error Response

```json
{
  "error": "error_type",
  "code": 400,
  "message": "Human readable error message"
}
```

### Error Codes

| Code | Error Type | Description |
|------|------------|-------------|
| 400 | `bad_request` | Invalid request parameters |
| 401 | `unauthorized` | Missing or invalid authentication |
| 403 | `forbidden` | Insufficient permissions |
| 404 | `not_found` | Resource not found |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server-side error |
| 503 | `service_unavailable` | Service temporarily unavailable |

---

## Public Endpoints

### Basic Health Check

Check if the API is running.

```
GET /health
```

**Response:**

```json
{
  "status": "ok"
}
```

---

### Detailed Health Check

Get comprehensive health status of all components.

```
GET /health/detailed
```

**Response (200 OK - healthy):**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "connected",
      "latency": "2.5ms"
    },
    "cache": {
      "status": "healthy",
      "message": "operational",
      "latency": "0ms"
    },
    "exchange_api": {
      "status": "healthy",
      "message": "connected",
      "latency": "150ms"
    },
    "rate_limiter": {
      "status": "healthy",
      "message": "operational"
    }
  }
}
```

**Response (503 - unhealthy):**

```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "unhealthy",
      "message": "connection refused"
    }
  }
}
```

---

## Currency Exchange Endpoints

### List Currencies

Get a list of all supported currencies.

```
GET /api/v1/currencies
```

**Response:**

```json
[
  {
    "code": "USD",
    "name": "United States Dollar"
  },
  {
    "code": "EUR",
    "name": "Euro"
  },
  {
    "code": "GBP",
    "name": "British Pound Sterling"
  }
]
```

**Notes:**
- Returns 160+ currencies including major world currencies
- Includes IRR (Iranian Rial) with special handling

---

### Get Exchange Rates

Get current exchange rates for a base currency.

```
GET /api/v1/rates/{base}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| base | path | Yes | Base currency code (e.g., USD, EUR) |

**Example:**

```bash
curl https://your-app.koyeb.app/api/v1/rates/USD
```

**Response:**

```json
{
  "base": "USD",
  "date": "2024-01-15",
  "rates": {
    "EUR": 0.9245,
    "GBP": 0.7892,
    "JPY": 145.32,
    "IRR": 420000.00
  }
}
```

**Notes:**
- Rates are cached for 5 minutes by default
- IRR rates are fetched from a separate data source

---

### Convert Currency

Convert an amount from one currency to another.

```
GET /api/v1/convert
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from | string | Yes | Source currency code |
| to | string | Yes | Target currency code |
| amount | number | Yes | Amount to convert (must be >= 0) |

**Example:**

```bash
curl "https://your-app.koyeb.app/api/v1/convert?from=USD&to=EUR&amount=100"
```

**Response:**

```json
{
  "from": "USD",
  "to": "EUR",
  "amount": 100,
  "result": 92.45,
  "rate": 0.9245
}
```

**Error Examples:**

Missing parameters:
```json
{
  "error": "bad_request",
  "code": 400,
  "message": "Missing required parameters: from, to, amount"
}
```

Invalid amount:
```json
{
  "error": "bad_request",
  "code": 400,
  "message": "Invalid amount value"
}
```

---

### Get Historical Rates

Get exchange rates for a specific date in the past.

```
GET /api/v1/historical/{date}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| date | path | Yes | Date in YYYY-MM-DD format |
| base | query | No | Base currency (default: USD) |

**Example:**

```bash
curl "https://your-app.koyeb.app/api/v1/historical/2024-01-01?base=EUR"
```

**Response:**

```json
{
  "base": "EUR",
  "date": "2024-01-01",
  "rates": {
    "USD": 1.1045,
    "GBP": 0.8632,
    "JPY": 156.78
  }
}
```

**Error Example:**

Invalid date format:
```json
{
  "error": "bad_request",
  "code": 400,
  "message": "Invalid date format. Use YYYY-MM-DD"
}
```

**Notes:**
- Historical data is available from 1999-01-04 onwards
- Weekends and holidays may return the most recent available data

---

## Authentication Endpoints

### Register

Create a new user account.

```
POST /api/v1/auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email address |
| password | string | Yes | Minimum 6 characters |
| name | string | No | User's display name |

**Response (201 Created):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Examples:**

Email already exists:
```json
{
  "error": "bad_request",
  "code": 400,
  "message": "email already registered"
}
```

Password too short:
```json
{
  "error": "bad_request",
  "code": 400,
  "message": "password must be at least 6 characters"
}
```

---

### Login

Authenticate and obtain a JWT token.

```
POST /api/v1/auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Example:**

Invalid credentials:
```json
{
  "error": "unauthorized",
  "code": 401,
  "message": "invalid email or password"
}
```

---

### Get Profile

Get the current authenticated user's profile.

```
GET /api/v1/auth/profile
```

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Examples:**

Missing token:
```json
{
  "error": "unauthorized",
  "code": 401,
  "message": "missing authorization header"
}
```

Expired token:
```json
{
  "error": "unauthorized",
  "code": 401,
  "message": "token expired"
}
```

---

### Refresh Token

Get a new access token using a refresh token.

```
POST /api/v1/auth/refresh
```

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

### Forgot Password

Request a password reset email.

```
POST /api/v1/auth/forgot-password
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**

```json
{
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

---

### Reset Password

Reset password using a token from the reset email.

```
POST /api/v1/auth/reset-password
```

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "new_password": "newsecurepassword123"
}
```

**Response (200 OK):**

```json
{
  "message": "Password reset successfully"
}
```

**Error Examples:**

Invalid or expired token:
```json
{
  "error": "bad_request",
  "code": 400,
  "message": "invalid or expired reset token"
}
```

---

### Logout

Revoke the current refresh token.

```
POST /api/v1/auth/logout
```

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "message": "Logged out successfully"
}
```

---

## Wallet Endpoints

All wallet endpoints require authentication.

### Get Balances

Get all currency balances for the authenticated user.

```
GET /api/v1/wallet/balances
```

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**

```json
{
  "balances": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "currency": "USD",
      "balance": 1500.50,
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "currency": "EUR",
      "balance": 750.25,
      "updated_at": "2024-01-15T09:00:00Z"
    }
  ]
}
```

---

### Get Wallet Summary

Get a comprehensive summary of the user's wallet including balances and recent transactions.

```
GET /api/v1/wallet/summary
```

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**

```json
{
  "balances": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "currency": "USD",
      "balance": 1500.50,
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "recent_transactions": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "credit",
      "amount": 500.00,
      "currency": "USD",
      "source": "manual",
      "description": "Initial deposit",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### Get Transactions

Get the transaction history for the authenticated user.

```
GET /api/v1/wallet/transactions
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | integer | No | 50 | Maximum number of transactions to return |
| offset | integer | No | 0 | Number of transactions to skip |
| search | string | No | - | Search in description |
| category | string | No | - | Filter by category |
| type | string | No | - | Filter by type (credit/debit/convert) |
| currency | string | No | - | Filter by currency code |
| from_date | string | No | - | Start date (YYYY-MM-DD) |
| to_date | string | No | - | End date (YYYY-MM-DD) |

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example:**

```bash
curl -H "Authorization: Bearer <token>" \
  "https://your-app.koyeb.app/api/v1/wallet/transactions?limit=10&offset=0"
```

**Response (200 OK):**

```json
{
  "transactions": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "credit",
      "amount": 500.00,
      "currency": "USD",
      "source": "manual",
      "description": "Salary deposit",
      "created_at": "2024-01-15T10:00:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "debit",
      "amount": 50.00,
      "currency": "USD",
      "source": "manual",
      "description": "Grocery shopping",
      "created_at": "2024-01-14T15:30:00Z"
    }
  ],
  "limit": 10,
  "offset": 0
}
```

---

### Add Transaction

Add a credit or debit transaction to the wallet.

```
POST /api/v1/wallet/transaction
```

**Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "type": "credit",
  "amount": 500.00,
  "currency": "USD",
  "description": "Salary deposit"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Transaction type: `credit` or `debit` |
| amount | number | Yes | Transaction amount (must be > 0) |
| currency | string | Yes | Currency code (e.g., USD, EUR) |
| category | string | No | Category (food, transportation, etc.) |
| description | string | No | Transaction description |

**Response (201 Created):**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "credit",
  "amount": 500.00,
  "currency": "USD",
  "source": "manual",
  "description": "Salary deposit",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Error Example:**

Insufficient balance for debit:
```json
{
  "error": "bad_request",
  "code": 400,
  "message": "insufficient balance"
}
```

---

### Convert Balance

Convert balance from one currency to another within the wallet.

```
POST /api/v1/wallet/convert
```

**Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "from_currency": "USD",
  "to_currency": "EUR",
  "amount": 100.00
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| from_currency | string | Yes | Source currency code |
| to_currency | string | Yes | Target currency code |
| amount | number | Yes | Amount to convert (must be > 0) |

**Response (200 OK):**

```json
{
  "from_currency": "USD",
  "to_currency": "EUR",
  "from_amount": 100.00,
  "to_amount": 92.45,
  "rate": 0.9245,
  "transaction": {
    "id": "660e8400-e29b-41d4-a716-446655440003",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "convert",
    "amount": 100.00,
    "currency": "USD",
    "to_amount": 92.45,
    "to_currency": "EUR",
    "rate": 0.9245,
    "source": "manual",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### Export Transactions

Export transaction history as CSV.

```
GET /api/v1/wallet/transactions/export
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| format | string | No | csv | Export format (currently only csv) |
| search | string | No | - | Search filter |
| category | string | No | - | Category filter |
| type | string | No | - | Type filter |
| currency | string | No | - | Currency filter |
| from_date | string | No | - | Start date |
| to_date | string | No | - | End date |

**Response:**

Returns a CSV file download with Content-Disposition header.

---

### Get Categories

Get available transaction categories.

```
GET /api/v1/wallet/categories
```

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**

```json
{
  "categories": [
    {
      "id": "default-food",
      "name": "food",
      "icon": "🍔",
      "color": "#ef4444",
      "is_default": true
    },
    {
      "id": "default-transportation",
      "name": "transportation",
      "icon": "🚗",
      "color": "#f97316",
      "is_default": true
    }
  ]
}
```

**Default Categories:**
- food, transportation, entertainment, shopping
- bills, income, transfer, other

---

## AI Endpoints

### Get AI Status

Check if the AI service is configured and available.

```
GET /api/v1/ai/status
```

**Response (200 OK):**

```json
{
  "configured": true,
  "provider": "googleai"
}
```

---

### Parse Receipt Text

Parse text from a receipt to extract transaction details. This endpoint uses AI to intelligently extract amount, currency, and transaction type from text.

```
POST /api/v1/ai/parse-text
```

**Request Body:**

```json
{
  "text": "Receipt from Amazon\nOrder Total: $125.99\nDate: January 15, 2024\nThank you for your purchase!"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | Yes | Receipt text to parse |

**Response (200 OK):**

```json
{
  "amount": 125.99,
  "currency": "USD",
  "type": "debit",
  "description": "Amazon purchase",
  "confidence": 0.95,
  "raw_text": "Receipt from Amazon..."
}
```

**Error Example:**

AI service not configured:
```json
{
  "error": "internal_error",
  "code": 500,
  "message": "AI service not configured"
}
```

---

### Apply Parsed Result

Apply an AI-parsed transaction to the user's wallet. Requires authentication.

```
POST /api/v1/ai/apply-parsed
```

**Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "amount": 125.99,
  "currency": "USD",
  "type": "debit",
  "description": "Amazon purchase"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Transaction amount |
| currency | string | Yes | Currency code |
| type | string | Yes | Transaction type: `credit` or `debit` |
| description | string | No | Transaction description |

**Response (201 Created):**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440004",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "debit",
  "amount": 125.99,
  "currency": "USD",
  "source": "ai_receipt",
  "description": "Amazon purchase",
  "created_at": "2024-01-15T11:00:00Z"
}
```

---

## Goals Endpoints

All goals endpoints require authentication.

### List Goals

Get all financial goals for the authenticated user.

```
GET /api/v1/goals
```

**Headers:**

```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**

```json
{
  "goals": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Emergency Fund",
      "target_amount": 10000.00,
      "current_amount": 5500.00,
      "currency": "USD",
      "category": "emergency_fund",
      "deadline": "2024-12-31",
      "progress": 55.0,
      "is_completed": false,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### Create Goal

Create a new financial goal.

```
POST /api/v1/goals
```

**Request Body:**

```json
{
  "name": "Vacation Fund",
  "target_amount": 5000.00,
  "currency": "USD",
  "category": "vacation",
  "deadline": "2024-06-01"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Goal name |
| target_amount | number | Yes | Target amount (> 0) |
| currency | string | Yes | Currency code |
| category | string | No | Goal category |
| deadline | string | No | Deadline date (YYYY-MM-DD) |

**Response (201 Created):**

```json
{
  "goal": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Vacation Fund",
    "target_amount": 5000.00,
    "current_amount": 0,
    "currency": "USD",
    "category": "vacation",
    "deadline": "2024-06-01",
    "progress": 0,
    "is_completed": false
  }
}
```

---

### Update Goal

Update an existing goal.

```
PUT /api/v1/goals/{id}
```

**Request Body:**

```json
{
  "name": "Updated Goal Name",
  "target_amount": 7500.00,
  "deadline": "2024-08-01"
}
```

---

### Delete Goal

Delete a goal.

```
DELETE /api/v1/goals/{id}
```

**Response (200 OK):**

```json
{
  "message": "goal deleted successfully"
}
```

---

### Contribute to Goal

Add funds to a goal from your wallet balance.

```
POST /api/v1/goals/{id}/contribute
```

**Request Body:**

```json
{
  "amount": 500.00
}
```

**Response (200 OK):**

```json
{
  "goal": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "current_amount": 6000.00,
    "progress": 60.0
  },
  "transaction": {
    "id": "660e8400-e29b-41d4-a716-446655440005",
    "type": "debit",
    "amount": 500.00,
    "source": "goal_contribution"
  }
}
```

---

### Get Goal Categories

Get available goal categories.

```
GET /api/v1/goals/categories
```

**Response (200 OK):**

```json
{
  "categories": [
    "savings",
    "emergency_fund",
    "vacation",
    "home",
    "car",
    "education",
    "retirement",
    "investment",
    "debt_payoff",
    "other"
  ]
}
```

---

## Tags Endpoints

All tags endpoints require authentication.

### List Tags

Get all tags for the authenticated user.

```
GET /api/v1/tags
```

**Response (200 OK):**

```json
{
  "tags": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "urgent",
      "color": "#ef4444",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### Create Tag

Create a new tag.

```
POST /api/v1/tags
```

**Request Body:**

```json
{
  "name": "business",
  "color": "#3b82f6"
}
```

---

### Delete Tag

Delete a tag.

```
DELETE /api/v1/tags/{id}
```

---

## Budgets Endpoints

All budgets endpoints require authentication.

### List Budgets

Get all budgets for the authenticated user with calculated spent amounts.

```
GET /api/v1/budgets
```

**Response (200 OK):**

```json
{
  "budgets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "category": "food",
      "amount": 500.00,
      "currency": "USD",
      "period": "monthly",
      "spent": 350.00,
      "remaining": 150.00,
      "progress": 70.0,
      "is_over_budget": false,
      "is_near_limit": false
    }
  ]
}
```

---

### Create Budget

Create a new budget.

```
POST /api/v1/budgets
```

**Request Body:**

```json
{
  "category": "entertainment",
  "amount": 200.00,
  "currency": "USD",
  "period": "monthly"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| category | string | Yes | Category name |
| amount | number | Yes | Budget amount (> 0) |
| currency | string | Yes | Currency code |
| period | string | No | "monthly" or "yearly" (default: monthly) |

---

### Update Budget

Update an existing budget.

```
PUT /api/v1/budgets/{id}
```

**Request Body:**

```json
{
  "amount": 300.00,
  "period": "monthly"
}
```

---

### Delete Budget

Delete a budget.

```
DELETE /api/v1/budgets/{id}
```

---

## Recurring Transactions Endpoints

All recurring endpoints require authentication.

### List Recurring Transactions

Get all recurring transactions for the authenticated user.

```
GET /api/v1/recurring
```

**Response (200 OK):**

```json
{
  "recurring_transactions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "type": "debit",
      "amount": 100.00,
      "currency": "USD",
      "category": "bills",
      "description": "Netflix subscription",
      "frequency": "monthly",
      "next_execution": "2024-02-01",
      "is_active": true,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### Create Recurring Transaction

Create a new recurring transaction.

```
POST /api/v1/recurring
```

**Request Body:**

```json
{
  "type": "debit",
  "amount": 15.99,
  "currency": "USD",
  "category": "entertainment",
  "description": "Streaming service",
  "frequency": "monthly",
  "next_execution": "2024-02-01"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | "credit" or "debit" |
| amount | number | Yes | Transaction amount (> 0) |
| currency | string | Yes | Currency code |
| category | string | No | Category name |
| description | string | No | Description |
| frequency | string | Yes | "daily", "weekly", "monthly", or "yearly" |
| next_execution | string | Yes | Next execution date (YYYY-MM-DD) |

---

### Update Recurring Transaction

Update an existing recurring transaction.

```
PUT /api/v1/recurring/{id}
```

**Request Body:**

```json
{
  "amount": 19.99,
  "is_active": true
}
```

---

### Delete Recurring Transaction

Delete a recurring transaction.

```
DELETE /api/v1/recurring/{id}
```

---

### Execute Recurring Transaction

Manually execute a recurring transaction.

```
POST /api/v1/recurring/{id}/execute
```

**Response (200 OK):**

```json
{
  "transaction": {
    "id": "660e8400-e29b-41d4-a716-446655440010",
    "type": "debit",
    "amount": 15.99,
    "currency": "USD",
    "source": "recurring"
  },
  "recurring_transaction": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "next_execution": "2024-03-01"
  },
  "message": "recurring transaction executed successfully"
}
```

---

## Reports Endpoints

All reports endpoints require authentication.

### Monthly Report

Get monthly income, expenses, and savings summary.

```
GET /api/v1/reports/monthly
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| year | integer | No | Year (default: current year) |
| month | integer | No | Month 1-12 (default: current month) |
| currency | string | No | Display currency (default: USD) |

**Response (200 OK):**

```json
{
  "year": 2024,
  "month": 1,
  "currency": "USD",
  "income": 5000.00,
  "expenses": 3500.00,
  "net": 1500.00,
  "savings_rate": 30.0
}
```

---

### Category Report

Get spending breakdown by category.

```
GET /api/v1/reports/category
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from_date | string | No | Start date (YYYY-MM-DD) |
| to_date | string | No | End date (YYYY-MM-DD) |
| currency | string | No | Display currency (default: USD) |

**Response (200 OK):**

```json
{
  "from_date": "2024-01-01",
  "to_date": "2024-01-31",
  "currency": "USD",
  "total": 3500.00,
  "categories": [
    {
      "category": "food",
      "amount": 800.00,
      "percentage": 22.86,
      "count": 15
    },
    {
      "category": "transportation",
      "amount": 400.00,
      "percentage": 11.43,
      "count": 8
    }
  ]
}
```

---

### Trends Report

Get income/expense trends over time.

```
GET /api/v1/reports/trends
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| months | integer | No | Number of months (default: 6, max: 24) |
| currency | string | No | Display currency (default: USD) |

**Response (200 OK):**

```json
{
  "currency": "USD",
  "months": 6,
  "trends": [
    {
      "period": "2023-08",
      "income": 4500.00,
      "expenses": 3200.00,
      "net": 1300.00
    },
    {
      "period": "2023-09",
      "income": 5000.00,
      "expenses": 3500.00,
      "net": 1500.00
    }
  ]
}
```

---

### Net Worth Report

Get total net worth and balance distribution.

```
GET /api/v1/reports/networth
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| currency | string | No | Display currency (default: USD) |

**Response (200 OK):**

```json
{
  "currency": "USD",
  "total_balance": 15000.00,
  "balances": [
    {
      "currency": "USD",
      "balance": 10000.00,
      "balance_in_base": 10000.00,
      "percentage": 66.67
    },
    {
      "currency": "EUR",
      "balance": 4500.00,
      "balance_in_base": 5000.00,
      "percentage": 33.33
    }
  ]
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
const API_BASE = 'https://your-app.koyeb.app/api/v1';
let authToken = localStorage.getItem('auth_token');

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Examples
const currencies = await fetchAPI('/currencies');
const rates = await fetchAPI('/rates/USD');
const conversion = await fetchAPI('/convert?from=USD&to=EUR&amount=100');

// Authentication
const { token, user } = await fetchAPI('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'user@example.com', password: 'password' }),
});
authToken = token;

// Protected endpoints
const balances = await fetchAPI('/wallet/balances');
```

### cURL Examples

```bash
# List currencies
curl https://your-app.koyeb.app/api/v1/currencies

# Get rates
curl https://your-app.koyeb.app/api/v1/rates/USD

# Convert currency
curl "https://your-app.koyeb.app/api/v1/convert?from=USD&to=EUR&amount=100"

# Register
curl -X POST https://your-app.koyeb.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John"}'

# Login
curl -X POST https://your-app.koyeb.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get profile (authenticated)
curl https://your-app.koyeb.app/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Add transaction (authenticated)
curl -X POST https://your-app.koyeb.app/api/v1/wallet/transaction \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"credit","amount":100,"currency":"USD","description":"Deposit"}'
```

### Python Example

```python
import requests

BASE_URL = "https://your-app.koyeb.app/api/v1"

class CoFinanceClient:
    def __init__(self):
        self.token = None

    def _headers(self):
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def login(self, email: str, password: str):
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            headers=self._headers()
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["token"]
        return data["user"]

    def get_rates(self, base: str = "USD"):
        response = requests.get(
            f"{BASE_URL}/rates/{base}",
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()

    def convert(self, from_currency: str, to_currency: str, amount: float):
        response = requests.get(
            f"{BASE_URL}/convert",
            params={"from": from_currency, "to": to_currency, "amount": amount},
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()

    def get_balances(self):
        response = requests.get(
            f"{BASE_URL}/wallet/balances",
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()

# Usage
client = CoFinanceClient()
client.login("user@example.com", "password123")
balances = client.get_balances()
```
