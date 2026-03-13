package service

import (
	"context"
	"testing"

	"github.com/rezacr588/currency-converter/internal/model"
)

// Tests for NewAIService
func TestNewAIService_Success(t *testing.T) {
	service, err := NewAIService("googleai", "test-api-key", "", "", "")
	if err != nil {
		t.Fatalf("NewAIService failed: %v", err)
	}

	if service == nil {
		t.Fatal("Expected service to be created")
	}

	if service.provider != "googleai" {
		t.Errorf("Expected provider googleai, got %s", service.provider)
	}
}

func TestNewAIService_EmptyAPIKey(t *testing.T) {
	_, err := NewAIService("googleai", "", "", "", "")
	if err == nil {
		t.Error("Expected error for empty API key")
	}

	if err.Error() != "AI_API_KEY is required" {
		t.Errorf("Unexpected error: %v", err)
	}
}

func TestNewAIService_DifferentProviders(t *testing.T) {
	providers := []string{"cerebras", "openai", "googleai", "gemini", ""}

	for _, provider := range providers {
		service, err := NewAIService(provider, "test-api-key", "", "", "")
		if err != nil {
			t.Errorf("NewAIService failed for provider %s: %v", provider, err)
		}

		expectedProvider := provider
		if provider == "" {
			expectedProvider = ""
		}

		if service.provider != expectedProvider {
			t.Errorf("Expected provider %s, got %s", expectedProvider, service.provider)
		}
	}
}

func TestNewAIService_WithCloudProject(t *testing.T) {
	service, err := NewAIService("googleai", "test-api-key", "", "", "my-project")
	if err != nil {
		t.Fatalf("NewAIService failed: %v", err)
	}

	if service.cloudProject != "my-project" {
		t.Errorf("Expected cloud project my-project, got %s", service.cloudProject)
	}
}

// Tests for IsConfigured
func TestIsConfigured_True(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	if !service.IsConfigured() {
		t.Error("Expected service to be configured")
	}
}

// Tests for GetProvider
func TestGetProvider(t *testing.T) {
	service, _ := NewAIService("openai", "test-api-key", "", "", "")

	if service.GetProvider() != "openai" {
		t.Errorf("Expected provider openai, got %s", service.GetProvider())
	}
}

// Tests for parseAIResponse
func TestParseAIResponse_ValidJSON(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `{"amount": 100.50, "currency": "USD", "type": "debit", "description": "Coffee purchase"}`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	if result.Amount != 100.50 {
		t.Errorf("Expected amount 100.50, got %f", result.Amount)
	}

	if result.Currency != "USD" {
		t.Errorf("Expected currency USD, got %s", result.Currency)
	}

	if result.Type != "debit" {
		t.Errorf("Expected type debit, got %s", result.Type)
	}

	if result.Description != "Coffee purchase" {
		t.Errorf("Expected description 'Coffee purchase', got %s", result.Description)
	}
}

func TestParseAIResponse_JSONWithMarkdown(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := "```json\n{\"amount\": 50.00, \"currency\": \"EUR\", \"type\": \"credit\", \"description\": \"Refund\"}\n```"

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	if result.Amount != 50.00 {
		t.Errorf("Expected amount 50.00, got %f", result.Amount)
	}

	if result.Currency != "EUR" {
		t.Errorf("Expected currency EUR, got %s", result.Currency)
	}
}

func TestParseAIResponse_JSONWithExtraText(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `Here is the extracted data:
	{"amount": 25.99, "currency": "GBP", "type": "debit", "description": "Lunch"}
	This was parsed from your receipt.`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	if result.Amount != 25.99 {
		t.Errorf("Expected amount 25.99, got %f", result.Amount)
	}

	if result.Currency != "GBP" {
		t.Errorf("Expected currency GBP, got %s", result.Currency)
	}
}

func TestParseAIResponse_DefaultCurrency(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `{"amount": 100, "type": "debit", "description": "Test"}`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	// Should default to USD
	if result.Currency != "USD" {
		t.Errorf("Expected default currency USD, got %s", result.Currency)
	}
}

func TestParseAIResponse_DefaultType(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `{"amount": 100, "currency": "EUR", "description": "Test"}`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	// Should default to debit
	if result.Type != "debit" {
		t.Errorf("Expected default type debit, got %s", result.Type)
	}
}

func TestParseAIResponse_InvalidType(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `{"amount": 100, "currency": "EUR", "type": "invalid", "description": "Test"}`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	// Should default to debit for invalid type
	if result.Type != "debit" {
		t.Errorf("Expected type to be corrected to debit, got %s", result.Type)
	}
}

func TestParseAIResponse_CurrencyNormalization(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `{"amount": 100, "currency": "eur", "type": "debit", "description": "Test"}`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	// Should normalize to uppercase
	if result.Currency != "EUR" {
		t.Errorf("Expected normalized currency EUR, got %s", result.Currency)
	}
}

// Tests for extractFieldsManually
func TestExtractFieldsManually_AllFields(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	text := `Some malformed response with "amount": 75.50 and "currency": "USD" also "type": "credit" and "description": "Test payment"`

	result := service.extractFieldsManually(text)

	if result.Amount != 75.50 {
		t.Errorf("Expected amount 75.50, got %f", result.Amount)
	}

	if result.Currency != "USD" {
		t.Errorf("Expected currency USD, got %s", result.Currency)
	}

	if result.Type != "credit" {
		t.Errorf("Expected type credit, got %s", result.Type)
	}

	if result.Description != "Test payment" {
		t.Errorf("Expected description 'Test payment', got %s", result.Description)
	}
}

func TestExtractFieldsManually_PartialFields(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	text := `Found "amount": 50.00 only`

	result := service.extractFieldsManually(text)

	if result.Amount != 50.00 {
		t.Errorf("Expected amount 50.00, got %f", result.Amount)
	}

	// Should have defaults for missing fields
	if result.Currency != "USD" {
		t.Errorf("Expected default currency USD, got %s", result.Currency)
	}

	if result.Type != "debit" {
		t.Errorf("Expected default type debit, got %s", result.Type)
	}
}

func TestExtractFieldsManually_NoFields(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	text := `Random text with no useful data`

	result := service.extractFieldsManually(text)

	// Should have defaults
	if result.Currency != "USD" {
		t.Errorf("Expected default currency USD, got %s", result.Currency)
	}

	if result.Type != "debit" {
		t.Errorf("Expected default type debit, got %s", result.Type)
	}

	if result.Amount != 0 {
		t.Errorf("Expected amount 0, got %f", result.Amount)
	}
}

// Tests for calculateConfidence
// New formula: amount(0.3) + currency(0.2) + type(0.2) + description(0.15) + category_inferred(0.15)
func TestCalculateConfidence_Full(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	result := &model.AIParseResult{
		Amount:      100,
		Currency:    "EUR",
		Type:        "debit",
		Description: "coffee at starbucks", // "coffee" triggers category inference
	}

	confidence := service.calculateConfidence(result)

	// 0.3 (amount > 0) + 0.2 (currency) + 0.2 (type) + 0.15 (description) + 0.15 (category inferred) = 1.0
	if confidence != 1.0 {
		t.Errorf("Expected confidence 1.0, got %f", confidence)
	}
}

func TestCalculateConfidence_DefaultCurrency(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	result := &model.AIParseResult{
		Amount:      100,
		Currency:    "USD",
		Type:        "debit",
		Description: "uber ride", // "uber" triggers category inference
	}

	confidence := service.calculateConfidence(result)

	// 0.3 (amount > 0) + 0.2 (currency - now equal for all) + 0.2 (type) + 0.15 (description) + 0.15 (category) = 1.0
	expected := 1.0
	if confidence < expected-0.001 || confidence > expected+0.001 {
		t.Errorf("Expected confidence ~1.0, got %f", confidence)
	}
}

func TestCalculateConfidence_ZeroAmount(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	result := &model.AIParseResult{
		Amount:      0,
		Currency:    "EUR",
		Type:        "debit",
		Description: "Test", // generic description, no category match
	}

	confidence := service.calculateConfidence(result)

	// 0 (amount = 0) + 0.2 (currency) + 0.2 (type) + 0.15 (description) + 0 (no category) = 0.55
	expected := 0.55
	if confidence < expected-0.001 || confidence > expected+0.001 {
		t.Errorf("Expected confidence ~0.55, got %f", confidence)
	}
}

func TestCalculateConfidence_Minimal(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	result := &model.AIParseResult{
		Amount:      0,
		Currency:    "",
		Type:        "",
		Description: "",
	}

	confidence := service.calculateConfidence(result)

	// Should be 0 since all fields are empty/zero
	if confidence != 0 {
		t.Errorf("Expected confidence 0, got %f", confidence)
	}
}

func TestCalculateConfidence_TypeOnly(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	result := &model.AIParseResult{
		Amount:      0,
		Currency:    "",
		Type:        "credit",
		Description: "",
	}

	confidence := service.calculateConfidence(result)

	// 0.2 for type only
	if confidence != 0.2 {
		t.Errorf("Expected confidence 0.2, got %f", confidence)
	}
}

// Tests for ParseReceipt (validation only - can't test actual LLM call)
func TestParseReceipt_EmptyImage(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	_, err := service.ParseReceipt(context.Background(), []byte{}, "image/png")
	if err == nil {
		t.Error("Expected error for empty image data")
	}

	if err.Error() != "image data is required" {
		t.Errorf("Unexpected error: %v", err)
	}
}

// Tests for ParseReceiptText (validation only - can't test actual LLM call)
func TestParseReceiptText_EmptyText(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	_, err := service.ParseReceiptText(context.Background(), "")
	if err == nil {
		t.Error("Expected error for empty text")
	}

	if err.Error() != "text is required" {
		t.Errorf("Unexpected error: %v", err)
	}
}

// Test credit type parsing
func TestParseAIResponse_CreditType(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `{"amount": 100, "currency": "USD", "type": "credit", "description": "Refund"}`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	if result.Type != "credit" {
		t.Errorf("Expected type credit, got %s", result.Type)
	}
}

// Test various currency codes
func TestParseAIResponse_VariousCurrencies(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	currencies := []string{"USD", "EUR", "GBP", "JPY", "IRR", "CAD", "AUD"}

	for _, currency := range currencies {
		response := `{"amount": 100, "currency": "` + currency + `", "type": "debit", "description": "Test"}`

		result, err := service.parseAIResponse(response)
		if err != nil {
			t.Fatalf("parseAIResponse failed for %s: %v", currency, err)
		}

		if result.Currency != currency {
			t.Errorf("Expected currency %s, got %s", currency, result.Currency)
		}
	}
}

// Test decimal amounts
func TestParseAIResponse_DecimalAmounts(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	testCases := []struct {
		input    string
		expected float64
	}{
		{`{"amount": 100, "currency": "USD", "type": "debit"}`, 100.0},
		{`{"amount": 100.00, "currency": "USD", "type": "debit"}`, 100.0},
		{`{"amount": 99.99, "currency": "USD", "type": "debit"}`, 99.99},
		{`{"amount": 0.01, "currency": "USD", "type": "debit"}`, 0.01},
		{`{"amount": 1234.56, "currency": "USD", "type": "debit"}`, 1234.56},
	}

	for _, tc := range testCases {
		result, err := service.parseAIResponse(tc.input)
		if err != nil {
			t.Fatalf("parseAIResponse failed for input %s: %v", tc.input, err)
		}

		if result.Amount != tc.expected {
			t.Errorf("For input %s: expected amount %f, got %f", tc.input, tc.expected, result.Amount)
		}
	}
}

// Test confidence is set after parsing
func TestParseAIResponse_ConfidenceIsSet(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `{"amount": 100.50, "currency": "EUR", "type": "debit", "description": "Coffee"}`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	// Should have non-zero confidence
	if result.Confidence <= 0 {
		t.Error("Expected confidence to be set")
	}

	// Full result should have confidence 1.0
	if result.Confidence != 1.0 {
		t.Errorf("Expected confidence 1.0 for complete result, got %f", result.Confidence)
	}
}

// Test parsing with whitespace
func TestParseAIResponse_Whitespace(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	response := `

	  {
	    "amount": 100,
	    "currency": "USD",
	    "type": "debit",
	    "description": "Test"
	  }

	`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	if result.Amount != 100 {
		t.Errorf("Expected amount 100, got %f", result.Amount)
	}
}

// Test provider normalization (lowercase)
func TestNewAIService_ProviderNormalization(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"GOOGLEAI", "googleai"},
		{"GoogleAI", "googleai"},
		{"OPENAI", "openai"},
		{"OpenAI", "openai"},
		{"CEREBRAS", "cerebras"},
		{"Cerebras", "cerebras"},
	}

	for _, tc := range testCases {
		service, err := NewAIService(tc.input, "test-api-key", "", "", "")
		if err != nil {
			t.Fatalf("NewAIService failed for %s: %v", tc.input, err)
		}

		if service.provider != tc.expected {
			t.Errorf("Expected provider %s, got %s", tc.expected, service.provider)
		}
	}
}

// Test parseAIResponse with malformed JSON that falls back to manual extraction
func TestParseAIResponse_FallbackToManualExtraction(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	// This JSON is malformed but contains extractable fields
	response := `Here is your data: "amount": 42.50 and the "currency": "GBP" with "type": "credit"`

	result, err := service.parseAIResponse(response)
	if err != nil {
		t.Fatalf("parseAIResponse failed: %v", err)
	}

	if result.Amount != 42.50 {
		t.Errorf("Expected amount 42.50, got %f", result.Amount)
	}

	if result.Currency != "GBP" {
		t.Errorf("Expected currency GBP, got %s", result.Currency)
	}

	if result.Type != "credit" {
		t.Errorf("Expected type credit, got %s", result.Type)
	}
}

// Test extractFieldsManually with different patterns
func TestExtractFieldsManually_AmountOnly(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	text := `The amount found is "amount": 123.45`

	result := service.extractFieldsManually(text)

	if result.Amount != 123.45 {
		t.Errorf("Expected amount 123.45, got %f", result.Amount)
	}
}

func TestExtractFieldsManually_DescriptionWithSpecialChars(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	text := `"amount": 100 and "description": "Grocery shopping at store"`

	result := service.extractFieldsManually(text)

	if result.Description != "Grocery shopping at store" {
		t.Errorf("Expected description 'Grocery shopping at store', got %s", result.Description)
	}
}

// Test calculateConfidence edge cases
func TestCalculateConfidence_DescriptionOnly(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	result := &model.AIParseResult{
		Amount:      0,
		Currency:    "",
		Type:        "",
		Description: "Some description",
	}

	confidence := service.calculateConfidence(result)

	// 0.15 for description only (new formula)
	if confidence != 0.15 {
		t.Errorf("Expected confidence 0.15, got %f", confidence)
	}
}

func TestCalculateConfidence_AmountOnly(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	result := &model.AIParseResult{
		Amount:      50,
		Currency:    "",
		Type:        "",
		Description: "",
	}

	confidence := service.calculateConfidence(result)

	// 0.3 for amount only (new formula)
	if confidence != 0.3 {
		t.Errorf("Expected confidence 0.3, got %f", confidence)
	}
}

// Test multiple markdown code block formats
func TestParseAIResponse_DifferentMarkdownFormats(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	testCases := []struct {
		name     string
		input    string
		expected float64
	}{
		{
			"simple code block",
			"```\n{\"amount\": 10}\n```",
			10,
		},
		{
			"json code block",
			"```json\n{\"amount\": 20}\n```",
			20,
		},
		{
			"leading text with json",
			"Here is the result:\n{\"amount\": 30}",
			30,
		},
		{
			"trailing text with json",
			"{\"amount\": 40}\nEnd of response",
			40,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := service.parseAIResponse(tc.input)
			if err != nil {
				t.Fatalf("parseAIResponse failed: %v", err)
			}

			if result.Amount != tc.expected {
				t.Errorf("Expected amount %f, got %f", tc.expected, result.Amount)
			}
		})
	}
}

// Test edge cases in type normalization
func TestParseAIResponse_TypeNormalization(t *testing.T) {
	service, _ := NewAIService("googleai", "test-api-key", "", "", "")

	testCases := []struct {
		input    string
		expected string
	}{
		{`{"amount": 100, "type": "CREDIT"}`, "debit"},    // Invalid - defaults to debit
		{`{"amount": 100, "type": "Credit"}`, "debit"},    // Invalid - defaults to debit
		{`{"amount": 100, "type": "expense"}`, "debit"},   // Invalid - defaults to debit
		{`{"amount": 100, "type": "credit"}`, "credit"},   // Valid
		{`{"amount": 100, "type": "debit"}`, "debit"},     // Valid
	}

	for _, tc := range testCases {
		result, err := service.parseAIResponse(tc.input)
		if err != nil {
			t.Fatalf("parseAIResponse failed for %s: %v", tc.input, err)
		}

		if result.Type != tc.expected {
			t.Errorf("For input %s: expected type %s, got %s", tc.input, tc.expected, result.Type)
		}
	}
}

// Test GetProvider and IsConfigured
func TestAIService_GetProviderAndIsConfigured(t *testing.T) {
	service, _ := NewAIService("openai", "api-key", "", "", "")

	if service.GetProvider() != "openai" {
		t.Errorf("Expected provider openai, got %s", service.GetProvider())
	}

	if !service.IsConfigured() {
		t.Error("Expected service to be configured")
	}
}

// Test with empty provider string
func TestNewAIService_EmptyProvider(t *testing.T) {
	service, err := NewAIService("", "test-api-key", "", "", "")
	if err != nil {
		t.Fatalf("NewAIService failed: %v", err)
	}

	// Empty provider should default to lowercase empty string
	if service.provider != "" {
		t.Errorf("Expected empty provider, got %s", service.provider)
	}
}
