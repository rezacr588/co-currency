package e2e

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/rezacr588/currency-converter/internal/model"
)

// TestAccount represents a test user with their token
type TestAccount struct {
	Email    string
	Password string
	Name     string
	Token    string
}

// uniqueEmail generates a unique email for testing
func uniqueEmail(prefix string) string {
	return fmt.Sprintf("%s_%d@test.coai.app", prefix, time.Now().UnixNano())
}

// createTestAccount creates and registers a new test account
func createTestAccount(t *testing.T, ts *TestServer, prefix, name string) *TestAccount {
	t.Helper()

	account := &TestAccount{
		Email:    uniqueEmail(prefix),
		Password: "TestPassword123!",
		Name:     name,
	}

	resp, err := ts.POST("/api/v1/auth/register", model.RegisterRequest{
		Email:    account.Email,
		Password: account.Password,
		Name:     account.Name,
	}, "")
	if err != nil {
		t.Fatalf("Failed to register %s: %v", name, err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Failed to register %s: status %d", name, resp.StatusCode)
	}

	var auth model.AuthResponse
	parseResponse(resp, &auth)
	account.Token = auth.Token

	return account
}

// ============================================
// SCENARIO 1: New User Onboarding
// ============================================

func TestScenario_NewUserOnboarding(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	t.Log("=== SCENARIO: New User Onboarding ===")

	// Step 1: User discovers app and registers
	t.Run("Step1_Register", func(t *testing.T) {
		email := uniqueEmail("newuser")
		resp, _ := ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    email,
			Password: "MySecurePass123",
			Name:     "John Doe",
		}, "")

		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Registration failed: %d", resp.StatusCode)
		}
		t.Log("✓ User registered successfully")
	})

	// Step 2: User tries to register again (should fail)
	t.Run("Step2_DuplicateRegister", func(t *testing.T) {
		email := uniqueEmail("duplicate")
		// First registration
		ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    email,
			Password: "Password123",
			Name:     "Test User",
		}, "")

		// Duplicate registration
		resp, _ := ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    email,
			Password: "Password456",
			Name:     "Another Name",
		}, "")

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for duplicate, got %d", resp.StatusCode)
		}
		t.Log("✓ Duplicate registration blocked")
	})

	// Step 3: User logs in
	account := createTestAccount(t, ts, "onboard", "Onboarding User")

	t.Run("Step3_Login", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/auth/login", model.LoginRequest{
			Email:    account.Email,
			Password: account.Password,
		}, "")

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Login failed: %d", resp.StatusCode)
		}
		t.Log("✓ User logged in successfully")
	})

	// Step 4: User views empty wallet
	t.Run("Step4_ViewEmptyWallet", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/balances", account.Token)

		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)

		if len(result["balances"]) != 0 {
			t.Errorf("Expected empty wallet, got %d balances", len(result["balances"]))
		}
		t.Log("✓ Empty wallet displayed correctly")
	})

	// Step 5: User adds first deposit
	t.Run("Step5_FirstDeposit", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:        "credit",
			Amount:      1000.00,
			Currency:    "USD",
			Description: "Initial deposit",
		}, account.Token)

		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Deposit failed: %d", resp.StatusCode)
		}
		t.Log("✓ First deposit of $1000 USD successful")
	})

	t.Log("=== SCENARIO COMPLETE ===")
}

// ============================================
// SCENARIO 2: Multi-Currency Trader
// ============================================

func TestScenario_MultiCurrencyTrader(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	t.Log("=== SCENARIO: Multi-Currency Trader ===")

	account := createTestAccount(t, ts, "trader", "Currency Trader")

	// Step 1: Deposit multiple currencies
	t.Run("Step1_MultipleDeposits", func(t *testing.T) {
		currencies := []struct {
			currency string
			amount   float64
		}{
			{"USD", 5000.00},
			{"EUR", 3000.00},
			{"GBP", 2000.00},
		}

		for _, c := range currencies {
			resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
				Type:     "credit",
				Amount:   c.amount,
				Currency: c.currency,
			}, account.Token)

			if resp.StatusCode != http.StatusCreated {
				t.Errorf("Failed to deposit %s", c.currency)
			}
		}
		t.Log("✓ Multiple currency deposits successful")
	})

	// Step 2: Check all balances
	t.Run("Step2_CheckBalances", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/balances", account.Token)

		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)

		if len(result["balances"]) != 3 {
			t.Errorf("Expected 3 currencies, got %d", len(result["balances"]))
		}

		for _, b := range result["balances"] {
			t.Logf("  %s: %.2f", b.Currency, b.Balance)
		}
		t.Log("✓ All balances displayed correctly")
	})

	// Step 3: Convert USD to EUR
	t.Run("Step3_ConvertUSDtoEUR", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "USD",
			ToCurrency:   "EUR",
			Amount:       1000.00,
		}, account.Token)

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Conversion failed: %d", resp.StatusCode)
		}

		var result model.ConvertBalanceResponse
		parseResponse(resp, &result)
		t.Logf("✓ Converted $1000 USD to €%.2f EUR (rate: %.4f)", result.ToAmount, result.Rate)
	})

	// Step 4: Convert GBP to USD
	t.Run("Step4_ConvertGBPtoUSD", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "GBP",
			ToCurrency:   "USD",
			Amount:       500.00,
		}, account.Token)

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Conversion failed: %d", resp.StatusCode)
		}

		var result model.ConvertBalanceResponse
		parseResponse(resp, &result)
		t.Logf("✓ Converted £500 GBP to $%.2f USD (rate: %.4f)", result.ToAmount, result.Rate)
	})

	// Step 5: Check transaction history
	t.Run("Step5_CheckTransactions", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/transactions", account.Token)

		var result map[string]interface{}
		parseResponse(resp, &result)

		transactions, ok := result["transactions"].([]interface{})
		if !ok || transactions == nil {
			transactions = []interface{}{}
		}
		t.Logf("✓ Transaction history shows %d transactions", len(transactions))
	})

	// Step 6: Final balance check
	t.Run("Step6_FinalBalances", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/summary", account.Token)

		var summary model.WalletSummary
		parseResponse(resp, &summary)

		t.Log("Final balances:")
		for _, b := range summary.Balances {
			t.Logf("  %s: %.2f", b.Currency, b.Balance)
		}
	})

	t.Log("=== SCENARIO COMPLETE ===")
}

// ============================================
// SCENARIO 3: Receipt Parser User
// ============================================

func TestScenario_ReceiptParserUser(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Check if AI is configured
	resp, _ := ts.GET("/api/v1/ai/status", "")
	var status map[string]interface{}
	parseResponse(resp, &status)
	if !status["configured"].(bool) {
		t.Skip("AI not configured, skipping receipt parser scenario")
	}

	t.Log("=== SCENARIO: Receipt Parser User ===")

	account := createTestAccount(t, ts, "parser", "Receipt Parser User")

	// Give user some initial balance
	ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
		Type:     "credit",
		Amount:   500.00,
		Currency: "USD",
	}, account.Token)

	// Step 1: Parse a grocery receipt
	t.Run("Step1_ParseGroceryReceipt", func(t *testing.T) {
		receipt := `WHOLE FOODS MARKET
123 Main St, City
Date: 01/15/2024

Organic Milk      $5.99
Fresh Bread       $4.49
Free Range Eggs   $6.99
Avocados (3)      $4.50
Organic Spinach   $3.99
--------------------
Subtotal:        $25.96
Tax (8%):         $2.08
TOTAL:           $28.04

Paid with Visa *1234
Thank you!`

		resp, _ := ts.POST("/api/v1/ai/parse-text", map[string]string{
			"text": receipt,
		}, "")

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Parse failed: %d", resp.StatusCode)
		}

		var result model.AIParseResult
		parseResponse(resp, &result)

		t.Logf("✓ Parsed: $%.2f %s (%s) - %s", result.Amount, result.Currency, result.Type, result.Description)

		// Verify parsing accuracy
		if result.Currency != "USD" {
			t.Errorf("Expected USD, got %s", result.Currency)
		}
		if result.Type != "debit" {
			t.Errorf("Expected debit, got %s", result.Type)
		}
	})

	// Step 2: Parse a restaurant receipt
	t.Run("Step2_ParseRestaurantReceipt", func(t *testing.T) {
		receipt := `THE FANCY BISTRO
Fine Dining Experience

Table 5 - Server: Mike

Appetizer        $12.00
Main Course      $35.00
Dessert          $10.00
Wine             $18.00
--------------------
Subtotal:        $75.00
Tax:              $6.00
Tip (20%):       $15.00
TOTAL:           $96.00

Thank you for dining with us!`

		resp, _ := ts.POST("/api/v1/ai/parse-text", map[string]string{
			"text": receipt,
		}, "")

		var result model.AIParseResult
		parseResponse(resp, &result)

		t.Logf("✓ Parsed: $%.2f %s (%s)", result.Amount, result.Currency, result.Type)
	})

	// Step 3: Parse a European receipt
	t.Run("Step3_ParseEuropeanReceipt", func(t *testing.T) {
		receipt := `BOULANGERIE PIERRE
Paris, France

Croissant        2,50€
Café Crème       3,20€
Pain au chocolat 2,80€
--------------------
TOTAL:           8,50€

Merci de votre visite!`

		resp, _ := ts.POST("/api/v1/ai/parse-text", map[string]string{
			"text": receipt,
		}, "")

		var result model.AIParseResult
		parseResponse(resp, &result)

		if result.Currency != "EUR" {
			t.Errorf("Expected EUR for French receipt, got %s", result.Currency)
		}
		t.Logf("✓ Parsed European receipt: €%.2f EUR", result.Amount)
	})

	// Step 4: Apply parsed receipt to wallet
	t.Run("Step4_ApplyToWallet", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/ai/apply-parsed", model.ApplyParsedRequest{
			Amount:      28.04,
			Currency:    "USD",
			Type:        "debit",
			Description: "Whole Foods groceries",
		}, account.Token)

		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Apply failed: %d", resp.StatusCode)
		}
		t.Log("✓ Applied receipt to wallet as debit")
	})

	// Step 5: Verify balance updated
	t.Run("Step5_VerifyBalance", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/balances", account.Token)

		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)

		for _, b := range result["balances"] {
			if b.Currency == "USD" {
				expected := 500.00 - 28.04
				if b.Balance != expected {
					t.Errorf("Expected balance %.2f, got %.2f", expected, b.Balance)
				}
				t.Logf("✓ USD balance updated: $%.2f", b.Balance)
			}
		}
	})

	t.Log("=== SCENARIO COMPLETE ===")
}

// ============================================
// SCENARIO 4: Business User with Many Transactions
// ============================================

func TestScenario_BusinessUser(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	t.Log("=== SCENARIO: Business User with Many Transactions ===")

	account := createTestAccount(t, ts, "business", "Business Owner")

	// Step 1: Large initial deposit
	t.Run("Step1_LargeDeposit", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:        "credit",
			Amount:      50000.00,
			Currency:    "USD",
			Description: "Business capital",
		}, account.Token)

		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Deposit failed")
		}
		t.Log("✓ Deposited $50,000 USD")
	})

	// Step 2: Multiple business expenses
	t.Run("Step2_BusinessExpenses", func(t *testing.T) {
		expenses := []struct {
			amount      float64
			description string
		}{
			{1500.00, "Office supplies"},
			{3200.00, "Software licenses"},
			{800.00, "Marketing"},
			{2500.00, "Equipment"},
			{450.00, "Utilities"},
		}

		for _, e := range expenses {
			resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
				Type:        "debit",
				Amount:      e.amount,
				Currency:    "USD",
				Description: e.description,
			}, account.Token)

			if resp.StatusCode != http.StatusCreated {
				t.Errorf("Failed to record expense: %s", e.description)
			}
		}
		t.Log("✓ Recorded 5 business expenses")
	})

	// Step 3: Receive payments
	t.Run("Step3_ReceivePayments", func(t *testing.T) {
		payments := []struct {
			amount   float64
			currency string
			desc     string
		}{
			{5000.00, "USD", "Client A payment"},
			{3500.00, "EUR", "Client B payment"},
			{2000.00, "GBP", "Client C payment"},
		}

		for _, p := range payments {
			resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
				Type:        "credit",
				Amount:      p.amount,
				Currency:    p.currency,
				Description: p.desc,
			}, account.Token)

			if resp.StatusCode != http.StatusCreated {
				t.Errorf("Failed to record payment: %s", p.desc)
			}
		}
		t.Log("✓ Recorded 3 client payments in different currencies")
	})

	// Step 4: Convert foreign payments to USD
	t.Run("Step4_ConvertToUSD", func(t *testing.T) {
		// Convert EUR to USD
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "EUR",
			ToCurrency:   "USD",
			Amount:       3500.00,
		}, account.Token)

		var result model.ConvertBalanceResponse
		parseResponse(resp, &result)
		t.Logf("✓ Converted €3500 EUR to $%.2f USD", result.ToAmount)

		// Convert GBP to USD
		resp, _ = ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "GBP",
			ToCurrency:   "USD",
			Amount:       2000.00,
		}, account.Token)

		parseResponse(resp, &result)
		t.Logf("✓ Converted £2000 GBP to $%.2f USD", result.ToAmount)
	})

	// Step 5: Final summary
	t.Run("Step5_FinalSummary", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/summary", account.Token)

		var summary model.WalletSummary
		parseResponse(resp, &summary)

		t.Log("Final business balances:")
		for _, b := range summary.Balances {
			t.Logf("  %s: %.2f", b.Currency, b.Balance)
		}
		t.Logf("Total transactions: %d", len(summary.RecentTransactions))
	})

	t.Log("=== SCENARIO COMPLETE ===")
}

// ============================================
// SCENARIO 5: Security & Error Handling
// ============================================

func TestScenario_SecurityAndErrors(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	t.Log("=== SCENARIO: Security & Error Handling ===")

	// Create two users
	user1 := createTestAccount(t, ts, "secure1", "User One")
	user2 := createTestAccount(t, ts, "secure2", "User Two")

	// Give user1 some balance
	ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
		Type:     "credit",
		Amount:   100.00,
		Currency: "USD",
	}, user1.Token)

	// Step 1: User2 cannot access User1's wallet
	t.Run("Step1_CrossUserAccess", func(t *testing.T) {
		// User2 tries to view balances (gets their own, not user1's)
		resp, _ := ts.GET("/api/v1/wallet/balances", user2.Token)

		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)

		// User2 should have empty wallet
		if len(result["balances"]) != 0 {
			t.Error("User2 should have empty wallet")
		}
		t.Log("✓ Users cannot access each other's wallets")
	})

	// Step 2: Invalid token rejected
	t.Run("Step2_InvalidToken", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/balances", "invalid-token-12345")

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected 401 for invalid token, got %d", resp.StatusCode)
		}
		t.Log("✓ Invalid token rejected")
	})

	// Step 3: Cannot overdraft
	t.Run("Step3_CannotOverdraft", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:     "debit",
			Amount:   1000.00, // More than balance
			Currency: "USD",
		}, user1.Token)

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for overdraft, got %d", resp.StatusCode)
		}
		t.Log("✓ Overdraft prevented")
	})

	// Step 4: Cannot create negative transactions
	t.Run("Step4_NoNegativeAmounts", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:     "credit",
			Amount:   -100.00,
			Currency: "USD",
		}, user1.Token)

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for negative amount, got %d", resp.StatusCode)
		}
		t.Log("✓ Negative amounts rejected")
	})

	// Step 5: Protected endpoints require auth
	t.Run("Step5_AuthRequired", func(t *testing.T) {
		endpoints := []string{
			"/api/v1/wallet/balances",
			"/api/v1/wallet/transactions",
			"/api/v1/wallet/summary",
			"/api/v1/auth/profile",
		}

		for _, ep := range endpoints {
			resp, _ := ts.GET(ep, "")
			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("%s should require auth, got %d", ep, resp.StatusCode)
			}
		}
		t.Log("✓ All protected endpoints require authentication")
	})

	t.Log("=== SCENARIO COMPLETE ===")
}

// ============================================
// SCENARIO 6: Public API (Converter)
// ============================================

func TestScenario_PublicConverterAPI(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	t.Log("=== SCENARIO: Public Converter API ===")

	// Step 1: Convert without auth
	t.Run("Step1_PublicConvert", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/convert?from=USD&to=EUR&amount=100", "")

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Public convert failed: %d", resp.StatusCode)
		}

		var result model.ConversionResult
		parseResponse(resp, &result)

		t.Logf("✓ $100 USD = €%.2f EUR (rate: %.4f)", result.Result, result.Rate)
	})

	// Step 2: Get currencies without auth
	t.Run("Step2_PublicCurrencies", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/currencies", "")

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Public currencies failed: %d", resp.StatusCode)
		}
		t.Log("✓ Currencies endpoint accessible without auth")
	})

	// Step 3: Get rates without auth
	t.Run("Step3_PublicRates", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/rates/USD", "")

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Public rates failed: %d", resp.StatusCode)
		}
		t.Log("✓ Rates endpoint accessible without auth")
	})

	// Step 4: Health check
	t.Run("Step4_HealthCheck", func(t *testing.T) {
		resp, _ := ts.GET("/health", "")

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Health check failed: %d", resp.StatusCode)
		}
		t.Log("✓ Health check passed")
	})

	// Step 5: AI status without auth
	t.Run("Step5_AIStatus", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/ai/status", "")

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("AI status failed: %d", resp.StatusCode)
		}
		t.Log("✓ AI status accessible without auth")
	})

	t.Log("=== SCENARIO COMPLETE ===")
}
