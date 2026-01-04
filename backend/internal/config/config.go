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
}

// Load parses environment variables into Config
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
