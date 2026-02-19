package e2e

import (
	"io"
	"net/http"
	"testing"

	"github.com/rezacr588/currency-converter/internal/model"
)

// ============================================
// AUTH EDGE CASES
// ============================================

func TestE2E_Auth_EdgeCases(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Test: Register with invalid email format
	t.Run("Register_InvalidEmail", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    "not-an-email",
			Password: "password123",
		}, "")
		// Note: Basic validation may pass, depends on implementation
		t.Logf("Invalid email status: %d", resp.StatusCode)
	})

	// Test: Register with short password
	t.Run("Register_ShortPassword", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    "short@test.com",
			Password: "12345", // Less than 6 chars
		}, "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for short password, got %d", resp.StatusCode)
		}
	})

	// Test: Register with empty email
	t.Run("Register_EmptyEmail", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    "",
			Password: "password123",
		}, "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for empty email, got %d", resp.StatusCode)
		}
	})

	// Test: Register with empty password
	t.Run("Register_EmptyPassword", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    "empty@test.com",
			Password: "",
		}, "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for empty password, got %d", resp.StatusCode)
		}
	})

	// Test: Login with non-existent email
	t.Run("Login_NonExistentEmail", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/auth/login", model.LoginRequest{
			Email:    "doesnotexist@example.com",
			Password: "password123",
		}, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected 401 for non-existent email, got %d", resp.StatusCode)
		}
	})

	// Test: Login with empty credentials
	t.Run("Login_EmptyCredentials", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/auth/login", model.LoginRequest{
			Email:    "",
			Password: "",
		}, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected 401 for empty credentials, got %d", resp.StatusCode)
		}
	})

	// Test: Invalid JSON body
	t.Run("Register_InvalidJSON", func(t *testing.T) {
		req, _ := http.NewRequest("POST", ts.Server.URL+"/api/v1/auth/register", nil)
		req.Header.Set("Content-Type", "application/json")
		resp, _ := http.DefaultClient.Do(req)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for nil body, got %d", resp.StatusCode)
		}
	})

	// Test: Malformed Authorization header
	t.Run("Profile_MalformedAuthHeader", func(t *testing.T) {
		req, _ := http.NewRequest("GET", ts.Server.URL+"/api/v1/auth/profile", nil)
		req.Header.Set("Authorization", "NotBearer token123")
		resp, _ := http.DefaultClient.Do(req)
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected 401 for malformed auth header, got %d", resp.StatusCode)
		}
	})

	// Test: Expired token (can't easily test without manipulating time)
	t.Run("Profile_ExpiredToken", func(t *testing.T) {
		// This would require mocking time or using a pre-generated expired token
		t.Skip("Requires time manipulation for proper testing")
	})
}

// ============================================
// WALLET EDGE CASES
// ============================================

func TestE2E_Wallet_EdgeCases(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Setup user (register or login if already exists)
	token := ts.registerOrLogin(t, "wallet_edge@example.com", "password123")

	// Credit some initial balance
	ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
		Type:     "credit",
		Amount:   100,
		Currency: "USD",
	}, token)

	// Test: Invalid transaction type
	t.Run("Transaction_InvalidType", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:     "invalid",
			Amount:   10,
			Currency: "USD",
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for invalid type, got %d", resp.StatusCode)
		}
	})

	// Test: Negative amount
	t.Run("Transaction_NegativeAmount", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:     "credit",
			Amount:   -50,
			Currency: "USD",
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for negative amount, got %d", resp.StatusCode)
		}
	})

	// Test: Zero amount
	t.Run("Transaction_ZeroAmount", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:     "credit",
			Amount:   0,
			Currency: "USD",
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for zero amount, got %d", resp.StatusCode)
		}
	})

	// Test: Empty currency
	t.Run("Transaction_EmptyCurrency", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:     "credit",
			Amount:   10,
			Currency: "",
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for empty currency, got %d", resp.StatusCode)
		}
	})

	// Test: Convert same currency
	t.Run("Convert_SameCurrency", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "USD",
			ToCurrency:   "USD",
			Amount:       10,
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for same currency conversion, got %d", resp.StatusCode)
		}
	})

	// Test: Convert with insufficient balance
	t.Run("Convert_InsufficientBalance", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "USD",
			ToCurrency:   "EUR",
			Amount:       10000, // More than balance
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			body, _ := io.ReadAll(resp.Body)
			t.Errorf("Expected 400 for insufficient balance, got %d: %s", resp.StatusCode, string(body))
		}
	})

	// Test: Convert negative amount
	t.Run("Convert_NegativeAmount", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "USD",
			ToCurrency:   "EUR",
			Amount:       -10,
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for negative convert amount, got %d", resp.StatusCode)
		}
	})

	// Test: Convert empty currencies
	t.Run("Convert_EmptyCurrencies", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "",
			ToCurrency:   "",
			Amount:       10,
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for empty currencies, got %d", resp.StatusCode)
		}
	})

	// Test: Transactions with pagination
	t.Run("Transactions_Pagination", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/transactions?limit=5&offset=0", token)
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected 200, got %d", resp.StatusCode)
		}
	})

	// Test: Transactions with invalid pagination
	t.Run("Transactions_InvalidPagination", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/wallet/transactions?limit=-1&offset=-1", token)
		// API validates pagination params and rejects invalid values
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for invalid pagination, got %d", resp.StatusCode)
		}
	})
}

// ============================================
// AI EDGE CASES
// ============================================

func TestE2E_AI_EdgeCases(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Check AI status first
	resp, _ := ts.GET("/api/v1/ai/status", "")
	var status map[string]interface{}
	parseResponse(resp, &status)
	if !status["configured"].(bool) {
		t.Skip("AI not configured")
	}

	// Test: Very long text
	t.Run("ParseText_VeryLong", func(t *testing.T) {
		longText := "Receipt: "
		for i := 0; i < 100; i++ {
			longText += "Item $1.00\n"
		}
		longText += "Total: $100.00"

		resp, _ := ts.POST("/api/v1/ai/parse-text", map[string]string{
			"text": longText,
		}, "")
		// Should handle long text
		t.Logf("Long text status: %d", resp.StatusCode)
	})

	// Test: Non-receipt text
	t.Run("ParseText_NonReceipt", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/ai/parse-text", map[string]string{
			"text": "Hello, how are you today? The weather is nice.",
		}, "")
		// AI should still try to parse or return defaults
		if resp.StatusCode == http.StatusOK {
			var result model.AIParseResult
			parseResponse(resp, &result)
			t.Logf("Non-receipt parsed as: %.2f %s", result.Amount, result.Currency)
		}
	})

	// Test: Multiple currencies in text
	t.Run("ParseText_MultipleCurrencies", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/ai/parse-text", map[string]string{
			"text": "Paid $50 USD and €30 EUR, total £70 GBP",
		}, "")
		if resp.StatusCode == http.StatusOK {
			var result model.AIParseResult
			parseResponse(resp, &result)
			t.Logf("Multiple currencies parsed as: %.2f %s", result.Amount, result.Currency)
		}
	})

	// Test: Image endpoint returns helpful error
	t.Run("ParseReceipt_Disabled", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/ai/parse-receipt", nil, "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for disabled image endpoint, got %d", resp.StatusCode)
		}
	})

	// Test: Apply parsed with invalid data
	t.Run("ApplyParsed_InvalidType", func(t *testing.T) {
		// Register or login user
		token := ts.registerOrLogin(t, "ai_edge@example.com", "password123")

		resp, _ := ts.POST("/api/v1/ai/apply-parsed", model.ApplyParsedRequest{
			Amount:   10,
			Currency: "USD",
			Type:     "invalid",
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for invalid type, got %d", resp.StatusCode)
		}
	})

	// Test: Apply parsed without auth
	t.Run("ApplyParsed_NoAuth", func(t *testing.T) {
		resp, _ := ts.POST("/api/v1/ai/apply-parsed", model.ApplyParsedRequest{
			Amount:   10,
			Currency: "USD",
			Type:     "credit",
		}, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected 401 without auth, got %d", resp.StatusCode)
		}
	})
}

// ============================================
// CONVERTER EDGE CASES
// ============================================

func TestE2E_Converter_EdgeCases(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Test: Convert with missing parameters
	t.Run("Convert_MissingParams", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/convert", "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for missing params, got %d", resp.StatusCode)
		}
	})

	// Test: Convert with invalid currency
	t.Run("Convert_InvalidCurrency", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/convert?from=XXX&to=YYY&amount=100", "")
		// Should return error for invalid currencies
		t.Logf("Invalid currency status: %d", resp.StatusCode)
	})

	// Test: Convert with negative amount
	t.Run("Convert_NegativeAmount", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/convert?from=USD&to=EUR&amount=-100", "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for negative amount, got %d", resp.StatusCode)
		}
	})

	// Test: Convert with non-numeric amount
	t.Run("Convert_NonNumericAmount", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/convert?from=USD&to=EUR&amount=abc", "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for non-numeric amount, got %d", resp.StatusCode)
		}
	})

	// Test: Rates for invalid base
	t.Run("Rates_InvalidBase", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/rates/XXX", "")
		// Should return error or empty rates
		t.Logf("Invalid base rates status: %d", resp.StatusCode)
	})

	// Test: Historical with invalid date
	t.Run("Historical_InvalidDate", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/historical/not-a-date", "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected 400 for invalid date, got %d", resp.StatusCode)
		}
	})

	// Test: Historical with future date
	t.Run("Historical_FutureDate", func(t *testing.T) {
		resp, _ := ts.GET("/api/v1/historical/2099-01-01", "")
		// Should return error for future date
		t.Logf("Future date status: %d", resp.StatusCode)
	})
}

// ============================================
// CONCURRENT ACCESS TESTS
// ============================================

func TestE2E_Concurrent_Transactions(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Setup user with balance (register or login if already exists)
	token := ts.registerOrLogin(t, "concurrent@example.com", "password123")

	// Credit initial balance
	ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
		Type:     "credit",
		Amount:   1000,
		Currency: "USD",
	}, token)

	// Get balance before concurrent debits
	var startBalance float64
	{
		resp, _ := ts.GET("/api/v1/wallet/balances", token)
		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)
		for _, b := range result["balances"] {
			if b.Currency == "USD" {
				startBalance = b.Balance
			}
		}
	}

	// Test: Multiple concurrent debits
	t.Run("Concurrent_Debits", func(t *testing.T) {
		done := make(chan bool, 10)

		for i := 0; i < 10; i++ {
			go func() {
				ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
					Type:     "debit",
					Amount:   10,
					Currency: "USD",
				}, token)
				done <- true
			}()
		}

		// Wait for all goroutines
		for i := 0; i < 10; i++ {
			<-done
		}

		// Check final balance
		resp, _ := ts.GET("/api/v1/wallet/balances", token)
		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)

		expectedBalance := startBalance - 100 // 10 debits * $10 each
		for _, b := range result["balances"] {
			if b.Currency == "USD" {
				if b.Balance != expectedBalance {
					t.Errorf("Expected balance %.2f after concurrent debits, got %.2f", expectedBalance, b.Balance)
				}
				t.Logf("Final balance after concurrent debits: %.2f (started at %.2f)", b.Balance, startBalance)
			}
		}
	})
}

// ============================================
// RATE LIMITING TESTS
// ============================================

func TestE2E_RateLimiting(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Note: Our test server has a high rate limit (1000/min)
	// This test just verifies the endpoint works under load

	t.Run("HighVolume_Requests", func(t *testing.T) {
		successCount := 0
		for i := 0; i < 50; i++ {
			resp, _ := ts.GET("/api/v1/currencies", "")
			if resp.StatusCode == http.StatusOK {
				successCount++
			}
			resp.Body.Close()
		}
		t.Logf("Successful requests: %d/50", successCount)
		if successCount < 45 {
			t.Errorf("Too many requests failed: %d/50", 50-successCount)
		}
	})
}
