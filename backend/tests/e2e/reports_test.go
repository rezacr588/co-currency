package e2e

import (
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
)

// ============================================
// REPORTS & INSIGHTS E2E TESTS
// ============================================

func TestE2E_Reports_And_Insights(t *testing.T) {
	ts := SetupTestServer(t)
	defer ts.Cleanup()

	// Setup: Register and login a user for report testing
	email := fmt.Sprintf("report_test_%d@example.com", os.Getpid())
	registerReq := model.RegisterRequest{
		Email:    email,
		Password: "testpassword123",
		Name:     "Report Test User",
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

	// Seed data: Add diverse transactions to generate meaningful reports
	// We'll simulate data for the current month
	t.Log("Seeding transaction data...")
	seedTransactions(t, ts, token)

	// Test 1: Get Monthly Report with Category Breakdown
	t.Run("GetMonthlyReport", func(t *testing.T) {
		year, month, _ := time.Now().Date()
		url := fmt.Sprintf("/api/v1/reports/monthly?year=%d&month=%d&currency=USD", year, month)
		
		resp, err := ts.GET(url, token)
		if err != nil {
			t.Fatalf("Failed to request monthly report: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var report service.MonthlyReport
		if err := parseResponse(resp, &report); err != nil {
			t.Fatalf("Failed to parse monthly report: %v", err)
		}

		// Verify core stats
		if report.Income != 5000.0 {
			t.Errorf("Expected income 5000.0, got %f", report.Income)
		}
		// Expenses: 150 (groceries) + 50 (entertainment) + 1200 (rent) = 1400
		if report.Expenses != 1400.0 {
			t.Errorf("Expected expenses 1400.0, got %f", report.Expenses)
		}
		if report.Net != 3600.0 {
			t.Errorf("Expected net 3600.0, got %f", report.Net)
		}

		// Verify category breakdown
		if len(report.Categories) == 0 {
			t.Error("Expected categories breakdown, got empty list")
		} else {
			foundRent := false
			for _, cat := range report.Categories {
				if cat.Category == "home" && cat.Amount == 1200.0 {
					foundRent = true
					break
				}
			}
			if !foundRent {
				t.Error("Category breakdown missing 'home' category with 1200.0 amount")
			}
		}
		t.Logf("Monthly Report: Income=%.2f, Expenses=%.2f, Categories=%d", report.Income, report.Expenses, len(report.Categories))
	})

	// Test 2: Get Yearly Report
	t.Run("GetYearlyReport", func(t *testing.T) {
		year := time.Now().Year()
		url := fmt.Sprintf("/api/v1/reports/yearly?year=%d&currency=USD", year)

		resp, err := ts.GET(url, token)
		if err != nil {
			t.Fatalf("Failed to request yearly report: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var report service.YearlyReport
		if err := parseResponse(resp, &report); err != nil {
			t.Fatalf("Failed to parse yearly report: %v", err)
		}

		// Verify yearly totals (should match monthly since we only seeded current month)
		if report.Income != 5000.0 {
			t.Errorf("Expected yearly income 5000.0, got %f", report.Income)
		}
		if report.Expenses != 1400.0 {
			t.Errorf("Expected yearly expenses 1400.0, got %f", report.Expenses)
		}
		if len(report.Months) == 0 {
			t.Error("Expected monthly breakdown in yearly report")
		}
		t.Logf("Yearly Report: Total Income=%.2f, Months with data=%d", report.Income, len(report.Months))
	})

	// Test 3: Get Forecast (Burn Rate)
	t.Run("GetForecast", func(t *testing.T) {
		resp, err := ts.GET("/api/v1/reports/forecast?currency=USD", token)
		if err != nil {
			t.Fatalf("Failed to request forecast: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var forecast service.ForecastReport
		if err := parseResponse(resp, &forecast); err != nil {
			t.Fatalf("Failed to parse forecast: %v", err)
		}

		// Verify averages
		// Expenses 1400 / 30 days ≈ 46.66/day
		if forecast.AvgDailySpend < 40.0 || forecast.AvgDailySpend > 50.0 {
			t.Errorf("Expected avg daily spend ~46.66, got %f", forecast.AvgDailySpend)
		}
		
		// Net flow should be positive (Income > Expenses)
		if forecast.NetDailyFlow <= 0 {
			t.Errorf("Expected positive net daily flow, got %f", forecast.NetDailyFlow)
		}

		// Days until zero should be -1 (infinite/positive)
		if forecast.DaysUntilZero != -1 {
			t.Errorf("Expected days_until_zero to be -1 for positive cashflow, got %d", forecast.DaysUntilZero)
		}
		t.Logf("Forecast: Daily Spend=%.2f, Net Flow=%.2f", forecast.AvgDailySpend, forecast.NetDailyFlow)
	})

	// Test 4: Get AI Insights
	// Note: This test might be skipped or mocked depending on AI config
	t.Run("GetInsights", func(t *testing.T) {
		// First check if AI is configured
		statusResp, _ := ts.GET("/api/v1/ai/status", "")
		var status map[string]interface{}
		parseResponse(statusResp, &status)
		
		if !status["configured"].(bool) {
			t.Skip("AI service not configured, skipping Insights test")
		}

		resp, err := ts.GET("/api/v1/reports/insights?currency=USD", token)
		if err != nil {
			t.Fatalf("Failed to request insights: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var insights model.InsightResponse
		if err := parseResponse(resp, &insights); err != nil {
			t.Fatalf("Failed to parse insights: %v", err)
		}

		// Verify structure
		if insights.Sentiment == "" {
			t.Error("Expected sentiment in insights")
		}
		if insights.Advice == "" {
			t.Error("Expected advice text in insights")
		}
		if len(insights.ActionItems) == 0 {
			t.Error("Expected action items in insights")
		}
		t.Logf("AI Insights: Sentiment=%s, Advice length=%d", insights.Sentiment, len(insights.Advice))
	})
}

// Helper to seed data
func seedTransactions(t *testing.T, ts *TestServer, token string) {
	transactions := []model.TransactionRequest{
		{
			Type:        "credit",
			Amount:      5000.00,
			Currency:    "USD",
			Category:    "income",
			Description: "Salary",
		},
		{
			Type:        "debit",
			Amount:      1200.00,
			Currency:    "USD",
			Category:    "home", // mapped to 'home' icon usually
			Description: "Monthly Rent",
		},
		{
			Type:        "debit",
			Amount:      150.00,
			Currency:    "USD",
			Category:    "food",
			Description: "Groceries",
		},
		{
			Type:        "debit",
			Amount:      50.00,
			Currency:    "USD",
			Category:    "entertainment",
			Description: "Movie night",
		},
	}

	for _, tx := range transactions {
		resp, err := ts.POST("/api/v1/wallet/transaction", tx, token)
		if err != nil {
			t.Fatalf("Failed to seed transaction: %v", err)
		}
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Failed to seed transaction, status: %d", resp.StatusCode)
		}
	}
}
