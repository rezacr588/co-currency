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

Tokens are obtained through the `/auth/login` or `/auth/register` endpoints and are valid for 7 days.

## Rate Limiting

All API endpoints (except `/health`) are rate-limited to prevent abuse:

- **Default Limit**: 100 requests per minute per IP address
- **Burst Allowance**: 10% of the limit (10 requests)
- **Rate Limit Header**: Not currently exposed

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

### Health Check

Check if the API is running and healthy.

```
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
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
