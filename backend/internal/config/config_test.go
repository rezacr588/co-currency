package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear any existing env vars
	os.Unsetenv("PORT")
	os.Unsetenv("ENVIRONMENT")
	os.Unsetenv("CACHE_TTL")
	os.Unsetenv("RATE_LIMIT")
	os.Unsetenv("FRANKFURTER_URL")
	os.Unsetenv("EXPOSE_ERROR_DETAILS")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("Port = %v, want %v", cfg.Port, "8080")
	}
	if cfg.Environment != "development" {
		t.Errorf("Environment = %v, want %v", cfg.Environment, "development")
	}
	if cfg.CacheTTL != 5*time.Minute {
		t.Errorf("CacheTTL = %v, want %v", cfg.CacheTTL, 5*time.Minute)
	}
	if cfg.RateLimitPerMin != 100 {
		t.Errorf("RateLimitPerMin = %v, want %v", cfg.RateLimitPerMin, 100)
	}
	if cfg.FrankfurterURL != "https://api.frankfurter.app" {
		t.Errorf("FrankfurterURL = %v, want %v", cfg.FrankfurterURL, "https://api.frankfurter.app")
	}
	if cfg.ExposeErrorDetails != true {
		t.Errorf("ExposeErrorDetails = %v, want true", cfg.ExposeErrorDetails)
	}
}

func TestLoad_CustomValues(t *testing.T) {
	os.Setenv("PORT", "3000")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("CACHE_TTL", "10m")
	os.Setenv("RATE_LIMIT", "200")
	os.Setenv("FRANKFURTER_URL", "https://custom.api.com")
	os.Setenv("EXPOSE_ERROR_DETAILS", "false")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("CACHE_TTL")
		os.Unsetenv("RATE_LIMIT")
		os.Unsetenv("FRANKFURTER_URL")
		os.Unsetenv("EXPOSE_ERROR_DETAILS")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Port != "3000" {
		t.Errorf("Port = %v, want %v", cfg.Port, "3000")
	}
	if cfg.Environment != "production" {
		t.Errorf("Environment = %v, want %v", cfg.Environment, "production")
	}
	if cfg.CacheTTL != 10*time.Minute {
		t.Errorf("CacheTTL = %v, want %v", cfg.CacheTTL, 10*time.Minute)
	}
	if cfg.RateLimitPerMin != 200 {
		t.Errorf("RateLimitPerMin = %v, want %v", cfg.RateLimitPerMin, 200)
	}
	if cfg.FrankfurterURL != "https://custom.api.com" {
		t.Errorf("FrankfurterURL = %v, want %v", cfg.FrankfurterURL, "https://custom.api.com")
	}
	if cfg.ExposeErrorDetails != false {
		t.Errorf("ExposeErrorDetails = %v, want false", cfg.ExposeErrorDetails)
	}
}

func TestLoad_JWTAndAIDefaults(t *testing.T) {
	// Clear any existing env vars
	os.Unsetenv("JWT_SECRET")
	os.Unsetenv("AI_PROVIDER")
	os.Unsetenv("AI_API_KEY")
	os.Unsetenv("AI_CLOUD_PROJECT")
	os.Unsetenv("EXPOSE_ERROR_DETAILS")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.JWTSecret != "change-me-in-production-to-a-secure-secret" {
		t.Errorf("JWTSecret = %v, want default", cfg.JWTSecret)
	}
	if cfg.AIProvider != "googleai" {
		t.Errorf("AIProvider = %v, want googleai", cfg.AIProvider)
	}
	if cfg.AIAPIKey != "" {
		t.Errorf("AIAPIKey = %v, want empty", cfg.AIAPIKey)
	}
	if cfg.AICloudProject != "" {
		t.Errorf("AICloudProject = %v, want empty", cfg.AICloudProject)
	}
}

func TestLoad_JWTAndAICustomValues(t *testing.T) {
	os.Setenv("JWT_SECRET", "super-secret-key")
	os.Setenv("AI_PROVIDER", "openai")
	os.Setenv("AI_API_KEY", "sk-test-key")
	os.Setenv("AI_CLOUD_PROJECT", "my-project")
	defer func() {
		os.Unsetenv("JWT_SECRET")
		os.Unsetenv("AI_PROVIDER")
		os.Unsetenv("AI_API_KEY")
		os.Unsetenv("AI_CLOUD_PROJECT")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.JWTSecret != "super-secret-key" {
		t.Errorf("JWTSecret = %v, want super-secret-key", cfg.JWTSecret)
	}
	if cfg.AIProvider != "openai" {
		t.Errorf("AIProvider = %v, want openai", cfg.AIProvider)
	}
	if cfg.AIAPIKey != "sk-test-key" {
		t.Errorf("AIAPIKey = %v, want sk-test-key", cfg.AIAPIKey)
	}
	if cfg.AICloudProject != "my-project" {
		t.Errorf("AICloudProject = %v, want my-project", cfg.AICloudProject)
	}
}

func TestLoad_DatabaseAndCrawlerDefaults(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	os.Unsetenv("IRR_CRAWLER_INTERVAL")
	os.Unsetenv("IRR_CRAWLER_ENABLED")
	os.Unsetenv("EXPOSE_ERROR_DETAILS")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.DatabaseURL != "" {
		t.Errorf("DatabaseURL = %v, want empty", cfg.DatabaseURL)
	}
	if cfg.IRRCrawlerInterval != 5*time.Minute {
		t.Errorf("IRRCrawlerInterval = %v, want 5m", cfg.IRRCrawlerInterval)
	}
	if cfg.IRRCrawlerEnabled != true {
		t.Errorf("IRRCrawlerEnabled = %v, want true", cfg.IRRCrawlerEnabled)
	}
}

func TestLoad_DatabaseAndCrawlerCustomValues(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://localhost:5432/test")
	os.Setenv("IRR_CRAWLER_INTERVAL", "10m")
	os.Setenv("IRR_CRAWLER_ENABLED", "false")
	defer func() {
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("IRR_CRAWLER_INTERVAL")
		os.Unsetenv("IRR_CRAWLER_ENABLED")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.DatabaseURL != "postgres://localhost:5432/test" {
		t.Errorf("DatabaseURL = %v, want postgres://localhost:5432/test", cfg.DatabaseURL)
	}
	if cfg.IRRCrawlerInterval != 10*time.Minute {
		t.Errorf("IRRCrawlerInterval = %v, want 10m", cfg.IRRCrawlerInterval)
	}
	if cfg.IRRCrawlerEnabled != false {
		t.Errorf("IRRCrawlerEnabled = %v, want false", cfg.IRRCrawlerEnabled)
	}
}

// Tests for MaxMemoryResults validation

func TestLoad_MaxMemoryResults_DefaultValue(t *testing.T) {
	// Clear any existing env vars that might interfere
	os.Unsetenv("MAX_MEMORY_RESULTS")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.MaxMemoryResults != 10 {
		t.Errorf("MaxMemoryResults = %v, want 10 (default)", cfg.MaxMemoryResults)
	}
}

func TestLoad_MaxMemoryResults_RejectsLessThan1(t *testing.T) {
	os.Setenv("MAX_MEMORY_RESULTS", "0")
	defer os.Unsetenv("MAX_MEMORY_RESULTS")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for MAX_MEMORY_RESULTS = 0, got nil")
	}
}

func TestLoad_MaxMemoryResults_RejectsNegative(t *testing.T) {
	os.Setenv("MAX_MEMORY_RESULTS", "-5")
	defer os.Unsetenv("MAX_MEMORY_RESULTS")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for MAX_MEMORY_RESULTS = -5, got nil")
	}
}

func TestLoad_MaxMemoryResults_RejectsGreaterThan100(t *testing.T) {
	os.Setenv("MAX_MEMORY_RESULTS", "101")
	defer os.Unsetenv("MAX_MEMORY_RESULTS")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for MAX_MEMORY_RESULTS = 101, got nil")
	}
}

func TestLoad_MaxMemoryResults_RejectsLargeValue(t *testing.T) {
	os.Setenv("MAX_MEMORY_RESULTS", "500")
	defer os.Unsetenv("MAX_MEMORY_RESULTS")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for MAX_MEMORY_RESULTS = 500, got nil")
	}
}

func TestLoad_MaxMemoryResults_AcceptsValidValues(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected int
	}{
		{"minimum value", "1", 1},
		{"low value", "5", 5},
		{"default value", "10", 10},
		{"mid value", "50", 50},
		{"maximum value", "100", 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("MAX_MEMORY_RESULTS", tt.value)
			defer os.Unsetenv("MAX_MEMORY_RESULTS")

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() error = %v for MAX_MEMORY_RESULTS = %s", err, tt.value)
			}

			if cfg.MaxMemoryResults != tt.expected {
				t.Errorf("MaxMemoryResults = %v, want %v", cfg.MaxMemoryResults, tt.expected)
			}
		})
	}
}

func TestLoad_MaxMemoryResults_BoundaryValues(t *testing.T) {
	tests := []struct {
		name        string
		value       string
		expectError bool
	}{
		{"0 - below minimum", "0", true},
		{"1 - at minimum", "1", false},
		{"2 - above minimum", "2", false},
		{"99 - below maximum", "99", false},
		{"100 - at maximum", "100", false},
		{"101 - above maximum", "101", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("MAX_MEMORY_RESULTS", tt.value)
			defer os.Unsetenv("MAX_MEMORY_RESULTS")

			_, err := Load()
			if tt.expectError && err == nil {
				t.Errorf("Expected error for MAX_MEMORY_RESULTS = %s, got nil", tt.value)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error for MAX_MEMORY_RESULTS = %s: %v", tt.value, err)
			}
		})
	}
}
