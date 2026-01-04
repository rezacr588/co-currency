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
}

func TestLoad_CustomValues(t *testing.T) {
	os.Setenv("PORT", "3000")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("CACHE_TTL", "10m")
	os.Setenv("RATE_LIMIT", "200")
	os.Setenv("FRANKFURTER_URL", "https://custom.api.com")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("CACHE_TTL")
		os.Unsetenv("RATE_LIMIT")
		os.Unsetenv("FRANKFURTER_URL")
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
}
