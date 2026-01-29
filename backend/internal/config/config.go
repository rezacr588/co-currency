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

	// LinkedIn OAuth
	LinkedInClientID     string `env:"LINKEDIN_CLIENT_ID" envDefault:""`
	LinkedInClientSecret string `env:"LINKEDIN_CLIENT_SECRET" envDefault:""`
	LinkedInRedirectURI  string `env:"LINKEDIN_REDIRECT_URI" envDefault:"http://localhost:8080/api/v1/auth/linkedin/callback"`

	// Google OAuth
	GoogleClientID     string `env:"GOOGLE_CLIENT_ID" envDefault:""`
	GoogleClientSecret string `env:"GOOGLE_CLIENT_SECRET" envDefault:""`
	GoogleRedirectURI  string `env:"GOOGLE_REDIRECT_URI" envDefault:"http://localhost:8080/api/v1/auth/google/callback"`

	FrontendURL string `env:"FRONTEND_URL" envDefault:"http://localhost:5173"`

	// AI Service settings
	AIProvider     string `env:"AI_PROVIDER" envDefault:"googleai"` // googleai, openai
	AIAPIKey       string `env:"AI_API_KEY" envDefault:""`
	AICloudProject string `env:"AI_CLOUD_PROJECT" envDefault:""` // Google Cloud project ID

	// Qdrant Vector Database
	QdrantURL     string `env:"QDRANT_URL" envDefault:""`
	QdrantAPIKey  string `env:"QDRANT_API_KEY" envDefault:""`
	QdrantEnabled bool   `env:"QDRANT_ENABLED" envDefault:"false"`

	// Embedding Provider (supports: huggingface, ollama, googleai)
	EmbeddingProvider   string `env:"EMBEDDING_PROVIDER" envDefault:"huggingface"`
	EmbeddingAPIKey     string `env:"EMBEDDING_API_KEY" envDefault:""`
	EmbeddingModel      string `env:"EMBEDDING_MODEL" envDefault:"sentence-transformers/all-MiniLM-L6-v2"`
	EmbeddingDimensions int    `env:"EMBEDDING_DIMENSIONS" envDefault:"384"`
	OllamaURL           string `env:"OLLAMA_URL" envDefault:"http://localhost:11434"`

	// Memory Settings
	ShortTermMemoryTTL time.Duration `env:"SHORT_TERM_MEMORY_TTL" envDefault:"24h"`
	MaxMemoryResults   int           `env:"MAX_MEMORY_RESULTS" envDefault:"10"`
}

// Load parses environment variables into Config
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
