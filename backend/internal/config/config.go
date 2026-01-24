package config

import (
	"time"

	"github.com/caarlos0/env/v9"
)

// Config holds all configuration for the application
type Config struct {
	Port            string        `env:"PORT" envDefault:"8080"`
	Environment     string        `env:"ENVIRONMENT" envDefault:"development"`
	CacheTTL        time.Duration `env:"CACHE_TTL" envDefault:"5m"`
	RateLimitPerMin int           `env:"RATE_LIMIT" envDefault:"100"`
	FrankfurterURL  string        `env:"FRANKFURTER_URL" envDefault:"https://api.frankfurter.app"`

	// IRR database and crawler settings
	DatabaseURL        string        `env:"DATABASE_URL" envDefault:""`
	IRRCrawlerInterval time.Duration `env:"IRR_CRAWLER_INTERVAL" envDefault:"5m"`
	IRRCrawlerEnabled  bool          `env:"IRR_CRAWLER_ENABLED" envDefault:"true"`

	// JWT Authentication
	JWTSecret string `env:"JWT_SECRET" envDefault:"change-me-in-production-to-a-secure-secret"`
	// Error handling
	ExposeErrorDetails bool `env:"EXPOSE_ERROR_DETAILS" envDefault:"true"`

	// GitHub OAuth
	GitHubClientID     string `env:"GITHUB_CLIENT_ID" envDefault:""`
	GitHubClientSecret string `env:"GITHUB_CLIENT_SECRET" envDefault:""`
	GitHubRedirectURI  string `env:"GITHUB_REDIRECT_URI" envDefault:"http://localhost:8080/api/v1/auth/github/callback"`
	FrontendURL        string `env:"FRONTEND_URL" envDefault:"http://localhost:5173"`

	// AI Service settings
	AIProvider     string `env:"AI_PROVIDER" envDefault:"googleai"` // googleai, openai
	AIAPIKey       string `env:"AI_API_KEY" envDefault:""`
	AICloudProject string `env:"AI_CLOUD_PROJECT" envDefault:""` // Google Cloud project ID
}

// Load parses environment variables into Config
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
