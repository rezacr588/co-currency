package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/router"
	"github.com/rezacr588/currency-converter/internal/service"
)

// TestServer holds the test server and its dependencies
type TestServer struct {
	Server         *httptest.Server
	DB             *repository.Database
	AuthService    *service.AuthService
	WalletService  *service.WalletService
	AIService      *service.AIService
	ReportsService *service.ReportsService
}

// SetupTestServer creates a test server with all dependencies
func SetupTestServer(t *testing.T) *TestServer {
	t.Helper()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping E2E test")
	}

	// Load config
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database
	db, err := repository.NewDatabase(dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	walletRepo := repository.NewWalletRepository(db)

	// Initialize services
	authService := service.NewAuthService(userRepo, nil, cfg.JWTSecret)

	// Initialize exchange service for wallet
	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	frankfurterClient := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	irrClient := repository.NewIRRClient(nil)
	exchangeService := service.NewExchangeService(cfg, frankfurterClient, cache, irrClient)

	walletService := service.NewWalletService(walletRepo, exchangeService)

	// Initialize AI service (optional)
	var aiService *service.AIService
	if cfg.AIAPIKey != "" {
		aiService, _ = service.NewAIService(cfg.AIProvider, cfg.AIAPIKey, cfg.AIModel, cfg.AIVisionModel, cfg.AICloudProject)
	}

	// Initialize Reports service
	reportsService := service.NewReportsService(walletRepo, exchangeService, aiService, nil, nil)

	// Initialize handlers
	exchangeHandler := handler.New(exchangeService)
	authHandler := handler.NewAuthHandler(authService)
	walletHandler := handler.NewWalletHandler(walletService)
	aiHandler := handler.NewAIHandler(aiService, walletService)
	reportsHandler := handler.NewReportsHandler(reportsService)

	handlers := &router.Handlers{
		Exchange: exchangeHandler,
		Auth:     authHandler,
		Wallet:   walletHandler,
		AI:       aiHandler,
		Reports:  reportsHandler,
	}

	rateLimiter := middleware.NewRateLimiter(1000) // High limit for tests
	authMiddleware := middleware.NewAuth(authService)

	// Create router and server
	r := router.New(handlers, rateLimiter, authMiddleware, nil)
	server := httptest.NewServer(r)

	return &TestServer{
		Server:         server,
		DB:             db,
		AuthService:    authService,
		WalletService:  walletService,
		AIService:      aiService,
		ReportsService: reportsService,
	}
}

// Cleanup closes the test server and database
func (ts *TestServer) Cleanup() {
	ts.Server.Close()
	ts.DB.Close()
}

// Helper methods for making HTTP requests

func (ts *TestServer) POST(path string, body interface{}, token string) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest("POST", ts.Server.URL+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	return http.DefaultClient.Do(req)
}

func (ts *TestServer) GET(path string, token string) (*http.Response, error) {
	req, err := http.NewRequest("GET", ts.Server.URL+path, nil)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	return http.DefaultClient.Do(req)
}

func parseResponse(resp *http.Response, v interface{}) error {
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(v)
}

// registerOrLogin registers a user and returns the auth token.
// If the user already exists, it falls back to login.
func (ts *TestServer) registerOrLogin(t *testing.T, email, password string) string {
	t.Helper()

	resp, err := ts.POST("/api/v1/auth/register", model.RegisterRequest{
		Email:    email,
		Password: password,
	}, "")
	if err != nil {
		t.Fatalf("Failed to register: %v", err)
	}

	if resp.StatusCode == http.StatusCreated {
		var auth model.AuthResponse
		parseResponse(resp, &auth)
		return auth.Token
	}
	resp.Body.Close()

	// Registration failed (user exists), try login
	resp, err = ts.POST("/api/v1/auth/login", model.LoginRequest{
		Email:    email,
		Password: password,
	}, "")
	if err != nil {
		t.Fatalf("Failed to login: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Login failed with status %d: %s", resp.StatusCode, string(body))
	}

	var auth model.AuthResponse
	parseResponse(resp, &auth)
	return auth.Token
}

// ============================================
// AUTH E2E TESTS
// ============================================

func TestE2E_Auth_RegisterLoginProfile(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Generate unique email for this test
	email := fmt.Sprintf("test_%d@example.com", os.Getpid())

	// Test 1: Register new user
	t.Run("Register", func(t *testing.T) {
		registerReq := model.RegisterRequest{
			Email:    email,
			Password: "testpassword123",
			Name:     "Test User",
		}

		resp, err := ts.POST("/api/v1/auth/register", registerReq, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 201, got %d: %s", resp.StatusCode, string(body))
		}

		var authResp model.AuthResponse
		if err := parseResponse(resp, &authResp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if authResp.Token == "" {
			t.Error("Expected token in response")
		}
		if authResp.User.Email != email {
			t.Errorf("Expected email %s, got %s", email, authResp.User.Email)
		}
		if authResp.User.Name != "Test User" {
			t.Errorf("Expected name 'Test User', got %s", authResp.User.Name)
		}
		t.Logf("Registered user: %s", authResp.User.ID)
	})

	// Test 2: Register with same email should fail
	t.Run("Register_Duplicate", func(t *testing.T) {
		registerReq := model.RegisterRequest{
			Email:    email,
			Password: "anotherpassword",
			Name:     "Another User",
		}

		resp, err := ts.POST("/api/v1/auth/register", registerReq, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected status 400 for duplicate email, got %d", resp.StatusCode)
		}
	})

	// Test 3: Login with correct credentials
	var token string
	t.Run("Login_Success", func(t *testing.T) {
		loginReq := model.LoginRequest{
			Email:    email,
			Password: "testpassword123",
		}

		resp, err := ts.POST("/api/v1/auth/login", loginReq, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(body))
		}

		var authResp model.AuthResponse
		if err := parseResponse(resp, &authResp); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if authResp.Token == "" {
			t.Error("Expected token in response")
		}
		token = authResp.Token
		t.Logf("Got JWT token: %s...", token[:20])
	})

	// Test 4: Login with wrong password
	t.Run("Login_WrongPassword", func(t *testing.T) {
		loginReq := model.LoginRequest{
			Email:    email,
			Password: "wrongpassword",
		}

		resp, err := ts.POST("/api/v1/auth/login", loginReq, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected status 401, got %d", resp.StatusCode)
		}
	})

	// Test 5: Get profile with valid token
	t.Run("GetProfile_WithToken", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/auth/profile", token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(body))
		}

		var profile model.UserProfile
		if err := parseResponse(resp, &profile); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if profile.Email != email {
			t.Errorf("Expected email %s, got %s", email, profile.Email)
		}
	})

	// Test 6: Get profile without token
	t.Run("GetProfile_NoToken", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/auth/profile", "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected status 401, got %d", resp.StatusCode)
		}
	})

	// Test 7: Get profile with invalid token
	t.Run("GetProfile_InvalidToken", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/auth/profile", "invalid-token")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected status 401, got %d", resp.StatusCode)
		}
	})
}

// ============================================
// WALLET E2E TESTS
// ============================================

func TestE2E_Wallet_Operations(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Setup: Register and login
	email := fmt.Sprintf("wallet_test_%d@example.com", os.Getpid())
	registerReq := model.RegisterRequest{
		Email:    email,
		Password: "testpassword123",
		Name:     "Wallet Test User",
	}

	resp, err := ts.POST("/api/v1/auth/register", registerReq, "")
	if err != nil {
		t.Fatalf("Failed to register: %v", err)
	}

	var authResp model.AuthResponse
	if err := parseResponse(resp, &authResp); err != nil {
		t.Fatalf("Failed to parse auth response: %v", err)
	}
	token := authResp.Token

	// Test 1: Get empty balances
	t.Run("GetBalances_Empty", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/wallet/balances", token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var result map[string][]model.WalletBalance
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if len(result["balances"]) != 0 {
			t.Errorf("Expected 0 balances, got %d", len(result["balances"]))
		}
	})

	// Test 2: Credit USD
	t.Run("Credit_USD", func(t *testing.T) {
		txReq := model.TransactionRequest{
			Type:        "credit",
			Amount:      100.50,
			Currency:    "USD",
			Description: "Initial deposit",
		}

		resp, err := ts.POST("/api/v1/wallet/transaction", txReq, token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 201, got %d: %s", resp.StatusCode, string(body))
		}

		var tx model.Transaction
		if err := parseResponse(resp, &tx); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if tx.Amount != 100.50 {
			t.Errorf("Expected amount 100.50, got %f", tx.Amount)
		}
		if tx.Currency != "USD" {
			t.Errorf("Expected currency USD, got %s", tx.Currency)
		}
		if tx.Type != "credit" {
			t.Errorf("Expected type credit, got %s", tx.Type)
		}
		t.Logf("Created transaction: %s", tx.ID)
	})

	// Test 3: Credit EUR
	t.Run("Credit_EUR", func(t *testing.T) {
		txReq := model.TransactionRequest{
			Type:        "credit",
			Amount:      50.00,
			Currency:    "EUR",
			Description: "Euro deposit",
		}

		resp, err := ts.POST("/api/v1/wallet/transaction", txReq, token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 201, got %d: %s", resp.StatusCode, string(body))
		}
	})

	// Test 4: Check balances after credits
	t.Run("GetBalances_AfterCredits", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/wallet/balances", token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		var result map[string][]model.WalletBalance
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		balances := result["balances"]
		if len(balances) != 2 {
			t.Fatalf("Expected 2 balances, got %d", len(balances))
		}

		for _, b := range balances {
			switch b.Currency {
			case "USD":
				if b.Balance != 100.50 {
					t.Errorf("Expected USD balance 100.50, got %f", b.Balance)
				}
			case "EUR":
				if b.Balance != 50.00 {
					t.Errorf("Expected EUR balance 50.00, got %f", b.Balance)
				}
			}
			t.Logf("Balance: %s %.2f", b.Currency, b.Balance)
		}
	})

	// Test 5: Debit USD
	t.Run("Debit_USD", func(t *testing.T) {
		txReq := model.TransactionRequest{
			Type:        "debit",
			Amount:      25.00,
			Currency:    "USD",
			Description: "Purchase",
		}

		resp, err := ts.POST("/api/v1/wallet/transaction", txReq, token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 201, got %d: %s", resp.StatusCode, string(body))
		}
	})

	// Test 6: Debit more than balance should fail
	t.Run("Debit_InsufficientBalance", func(t *testing.T) {
		txReq := model.TransactionRequest{
			Type:        "debit",
			Amount:      1000.00,
			Currency:    "USD",
			Description: "Too much",
		}

		resp, err := ts.POST("/api/v1/wallet/transaction", txReq, token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected status 400 for insufficient balance, got %d", resp.StatusCode)
		}
	})

	// Test 7: Convert USD to EUR
	t.Run("Convert_USD_to_EUR", func(t *testing.T) {
		convertReq := model.ConvertBalanceRequest{
			FromCurrency: "USD",
			ToCurrency:   "EUR",
			Amount:       20.00,
		}

		resp, err := ts.POST("/api/v1/wallet/convert", convertReq, token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(body))
		}

		var result model.ConvertBalanceResponse
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if result.FromAmount != 20.00 {
			t.Errorf("Expected from amount 20.00, got %f", result.FromAmount)
		}
		if result.ToAmount <= 0 {
			t.Errorf("Expected positive to amount, got %f", result.ToAmount)
		}
		if result.Rate <= 0 {
			t.Errorf("Expected positive rate, got %f", result.Rate)
		}
		t.Logf("Converted $20 USD to €%.2f EUR at rate %.4f", result.ToAmount, result.Rate)
	})

	// Test 8: Get transactions
	t.Run("GetTransactions", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/wallet/transactions", token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var result map[string]interface{}
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		transactions := result["transactions"].([]interface{})
		if len(transactions) < 4 {
			t.Errorf("Expected at least 4 transactions, got %d", len(transactions))
		}
		t.Logf("Total transactions: %d", len(transactions))
	})

	// Test 9: Get wallet summary
	t.Run("GetSummary", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/wallet/summary", token)
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var summary model.WalletSummary
		if err := parseResponse(resp, &summary); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		t.Logf("Wallet has %d currencies and %d recent transactions",
			len(summary.Balances), len(summary.RecentTransactions))
	})

	// Test 10: Delete transaction
	t.Run("DeleteTransaction", func(t *testing.T) {
		// Get transactions first to find an ID
		resp, _ := ts.GET("/api/v1/wallet/transactions", token)
		var result map[string]interface{}
		parseResponse(resp, &result)
		txs := result["transactions"].([]interface{})
		if len(txs) == 0 {
			t.Fatal("No transactions to delete")
		}
		tx := txs[0].(map[string]interface{})
		txID := tx["id"].(string)

		// Delete it
		req, _ := http.NewRequest("DELETE", ts.Server.URL+"/api/v1/wallet/transactions/"+txID, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err = http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("Delete request failed: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(body))
		}
	})

	// Test 11: Access wallet without token
	t.Run("Wallet_NoAuth", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/wallet/balances", "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected status 401, got %d", resp.StatusCode)
		}
	})
}

// ============================================
// AI PARSING E2E TESTS
// ============================================

func TestE2E_AI_ParseText(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Check if AI is configured
	resp, err := ts.GET("/api/v1/ai/status", "")
	if err != nil {
		t.Fatalf("Failed to check AI status: %v", err)
	}

	var status map[string]interface{}
	if err := parseResponse(resp, &status); err != nil {
		t.Fatalf("Failed to parse status: %v", err)
	}

	if !status["configured"].(bool) {
		t.Skip("AI service not configured, skipping AI tests")
	}

	t.Logf("AI Provider: %s", status["provider"])

	// Test 1: Parse USD receipt
	t.Run("Parse_USD_Receipt", func(t *testing.T) {
		body := map[string]string{
			"text": "WALMART STORE #1234\nDate: 01/15/2024\nMilk - $3.99\nBread - $2.49\nTOTAL: $6.48\nPayment: VISA",
		}

		resp, err := ts.POST("/api/v1/ai/parse-text", body, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(respBody))
		}

		var result model.AIParseResult
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if result.Amount != 6.48 {
			t.Errorf("Expected amount 6.48, got %f", result.Amount)
		}
		if result.Currency != "USD" {
			t.Errorf("Expected currency USD, got %s", result.Currency)
		}
		if result.Type != "debit" {
			t.Errorf("Expected type debit, got %s", result.Type)
		}
		t.Logf("Parsed: %.2f %s (%s) - %s", result.Amount, result.Currency, result.Type, result.Description)
	})

	// Test 2: Parse EUR receipt
	t.Run("Parse_EUR_Receipt", func(t *testing.T) {
		body := map[string]string{
			"text": "CARREFOUR Paris\nCroissant 2.50€\nCafé 1.80€\nTotal: 4.30€",
		}

		resp, err := ts.POST("/api/v1/ai/parse-text", body, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(respBody))
		}

		var result model.AIParseResult
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if result.Currency != "EUR" {
			t.Errorf("Expected currency EUR, got %s", result.Currency)
		}
		t.Logf("Parsed: %.2f %s (%s)", result.Amount, result.Currency, result.Type)
	})

	// Test 3: Parse refund (should be credit)
	t.Run("Parse_Refund", func(t *testing.T) {
		body := map[string]string{
			"text": "REFUND RECEIPT\nAmazon Return\nRefund Amount: $29.99\nRefunded to Visa",
		}

		resp, err := ts.POST("/api/v1/ai/parse-text", body, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(respBody))
		}

		var result model.AIParseResult
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if result.Type != "credit" {
			t.Errorf("Expected type credit for refund, got %s", result.Type)
		}
		t.Logf("Parsed refund: %.2f %s (%s)", result.Amount, result.Currency, result.Type)
	})

	// Test 4: Parse empty text should fail
	t.Run("Parse_EmptyText", func(t *testing.T) {
		body := map[string]string{
			"text": "",
		}

		resp, err := ts.POST("/api/v1/ai/parse-text", body, "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected status 400 for empty text, got %d", resp.StatusCode)
		}
	})
}

// ============================================
// FULL USER JOURNEY E2E TEST
// ============================================

func TestE2E_FullUserJourney(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	email := fmt.Sprintf("journey_%d@example.com", os.Getpid())
	var token string

	// Step 1: User registers
	t.Log("=== Step 1: User Registration ===")
	{
		resp, err := ts.POST("/api/v1/auth/register", model.RegisterRequest{
			Email:    email,
			Password: "securepassword123",
			Name:     "Journey User",
		}, "")
		if err != nil {
			t.Fatalf("Registration failed: %v", err)
		}
		if resp.StatusCode != http.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Registration failed: %s", string(body))
		}
		var auth model.AuthResponse
		parseResponse(resp, &auth)
		token = auth.Token
		t.Logf("Registered user: %s", auth.User.Email)
	}

	// Step 2: User checks empty wallet
	t.Log("=== Step 2: Check Empty Wallet ===")
	{
		resp, _ := ts.GET("/api/v1/wallet/balances", token)
		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)
		t.Logf("Initial balances: %d currencies", len(result["balances"]))
	}

	// Step 3: User receives salary (credit)
	t.Log("=== Step 3: Receive Salary ===")
	{
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:        "credit",
			Amount:      5000.00,
			Currency:    "USD",
			Description: "Monthly salary",
		}, token)
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Failed to credit salary")
		}
		t.Log("Credited $5000 USD salary")
	}

	// Step 4: User makes a purchase (debit)
	t.Log("=== Step 4: Make Purchase ===")
	{
		resp, _ := ts.POST("/api/v1/wallet/transaction", model.TransactionRequest{
			Type:        "debit",
			Amount:      150.00,
			Currency:    "USD",
			Description: "Grocery shopping",
		}, token)
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Failed to debit purchase")
		}
		t.Log("Debited $150 USD for groceries")
	}

	// Step 5: User converts USD to EUR for vacation
	t.Log("=== Step 5: Convert Currency ===")
	{
		resp, _ := ts.POST("/api/v1/wallet/convert", model.ConvertBalanceRequest{
			FromCurrency: "USD",
			ToCurrency:   "EUR",
			Amount:       1000.00,
		}, token)
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Failed to convert: %s", string(body))
		}
		var result model.ConvertBalanceResponse
		parseResponse(resp, &result)
		t.Logf("Converted $1000 USD to €%.2f EUR", result.ToAmount)
	}

	// Step 6: Check AI status
	t.Log("=== Step 6: Check AI Status ===")
	var aiConfigured bool
	{
		resp, _ := ts.GET("/api/v1/ai/status", "")
		var status map[string]interface{}
		parseResponse(resp, &status)
		aiConfigured = status["configured"].(bool)
		t.Logf("AI configured: %v", aiConfigured)
	}

	// Step 7: Parse a receipt with AI (if available)
	if aiConfigured {
		t.Log("=== Step 7: Parse Receipt with AI ===")
		var parsedAmount float64
		var parsedCurrency string
		{
			resp, _ := ts.POST("/api/v1/ai/parse-text", map[string]string{
				"text": "Coffee Shop Receipt\nLatte: $5.50\nMuffin: $3.25\nTotal: $8.75",
			}, "")
			if resp.StatusCode == http.StatusOK {
				var result model.AIParseResult
				parseResponse(resp, &result)
				parsedAmount = result.Amount
				parsedCurrency = result.Currency
				t.Logf("AI parsed: %.2f %s (%s)", result.Amount, result.Currency, result.Type)
			}
		}

		// Step 8: Apply parsed receipt to wallet
		if parsedAmount > 0 {
			t.Log("=== Step 8: Apply Parsed Receipt ===")
			{
				resp, _ := ts.POST("/api/v1/ai/apply-parsed", model.ApplyParsedRequest{
					Amount:      parsedAmount,
					Currency:    parsedCurrency,
					Type:        "debit",
					Description: "Coffee shop purchase",
				}, token)
				if resp.StatusCode == http.StatusCreated {
					t.Logf("Applied %.2f %s debit to wallet", parsedAmount, parsedCurrency)
				}
			}
		}
	}

	// Step 9: Check final wallet state
	t.Log("=== Step 9: Final Wallet State ===")
	{
		resp, _ := ts.GET("/api/v1/wallet/summary", token)
		var summary model.WalletSummary
		parseResponse(resp, &summary)

		t.Log("Final balances:")
		for _, b := range summary.Balances {
			t.Logf("  %s: %.2f", b.Currency, b.Balance)
		}
		t.Logf("Total transactions: %d", len(summary.RecentTransactions))
	}

	// Step 10: User logs out and logs back in
	t.Log("=== Step 10: Re-login ===")
	{
		resp, _ := ts.POST("/api/v1/auth/login", model.LoginRequest{
			Email:    email,
			Password: "securepassword123",
		}, "")
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Re-login failed")
		}
		var auth model.AuthResponse
		parseResponse(resp, &auth)
		t.Logf("Re-logged in successfully, new token issued")

		// Verify wallet persisted
		resp, _ = ts.GET("/api/v1/wallet/balances", auth.Token)
		var result map[string][]model.WalletBalance
		parseResponse(resp, &result)
		if len(result["balances"]) == 0 {
			t.Error("Wallet data not persisted!")
		} else {
			t.Log("Wallet data persisted correctly")
		}
	}

	t.Log("=== User Journey Complete ===")
}

// ============================================
// CONVERTER E2E TESTS (existing functionality)
// ============================================

func TestE2E_Converter_StillWorks(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Test that existing converter endpoints still work
	t.Run("Convert_USD_EUR", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/convert?from=USD&to=EUR&amount=100", "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			t.Fatalf("Expected status 200, got %d: %s", resp.StatusCode, string(body))
		}

		var result model.ConversionResult
		if err := parseResponse(resp, &result); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		if result.From != "USD" || result.To != "EUR" {
			t.Errorf("Expected USD->EUR, got %s->%s", result.From, result.To)
		}
		if result.Amount != 100 {
			t.Errorf("Expected amount 100, got %f", result.Amount)
		}
		if result.Rate <= 0 {
			t.Errorf("Expected positive rate, got %f", result.Rate)
		}
		t.Logf("$100 USD = €%.2f EUR (rate: %.4f)", result.Result, result.Rate)
	})

	t.Run("GetCurrencies", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/currencies", "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}
	})

	t.Run("GetRates", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/rates/USD", "")
		if err != nil {
			t.Fatalf("Failed to make request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}
	})
}
