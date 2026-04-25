package config

import (
	"fmt"
	"strings"
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
	MetricsEnabled  bool          `env:"METRICS_ENABLED" envDefault:"true"`

	// HTTP server settings
	HTTPReadTimeout       time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"15s"`
	HTTPReadHeaderTimeout time.Duration `env:"HTTP_READ_HEADER_TIMEOUT" envDefault:"10s"`
	HTTPWriteTimeout      time.Duration `env:"HTTP_WRITE_TIMEOUT" envDefault:"5m"`
	HTTPIdleTimeout       time.Duration `env:"HTTP_IDLE_TIMEOUT" envDefault:"120s"`
	HTTPShutdownTimeout   time.Duration `env:"HTTP_SHUTDOWN_TIMEOUT" envDefault:"20s"`
	HTTPMaxHeaderBytes    int           `env:"HTTP_MAX_HEADER_BYTES" envDefault:"1048576"` // 1 MiB

	// Database pool settings
	DatabaseURL         string        `env:"DATABASE_URL" envDefault:""`
	DBMaxConns          int32         `env:"DB_MAX_CONNS" envDefault:"50"`
	DBMinConns          int32         `env:"DB_MIN_CONNS" envDefault:"10"`
	DBMaxConnLifetime   time.Duration `env:"DB_MAX_CONN_LIFETIME" envDefault:"30m"`
	DBMaxConnIdleTime   time.Duration `env:"DB_MAX_CONN_IDLE_TIME" envDefault:"5m"`
	DBHealthCheckPeriod time.Duration `env:"DB_HEALTH_CHECK_PERIOD" envDefault:"30s"`

	// IRR crawler settings
	IRRCrawlerInterval time.Duration `env:"IRR_CRAWLER_INTERVAL" envDefault:"5m"`
	IRRCrawlerEnabled  bool          `env:"IRR_CRAWLER_ENABLED" envDefault:"true"`

	// Inflation crawler settings
	InflationCrawlerEnabled  bool          `env:"INFLATION_CRAWLER_ENABLED" envDefault:"true"`
	InflationCrawlerInterval time.Duration `env:"INFLATION_CRAWLER_INTERVAL" envDefault:"24h"`

	// Autopilot scheduler settings. AutopilotTickInterval controls how often the
	// scheduler checks for users whose local autopilot_time has arrived. Keep
	// short (≤15m) so users near their preferred hour get scans promptly and
	// cold-start recovery is fast; per-user dedup is enforced via the last-run
	// timestamp in the daily_autopilot_results table.
	AutopilotEnabled      bool          `env:"AUTOPILOT_ENABLED" envDefault:"true"`
	AutopilotTickInterval time.Duration `env:"AUTOPILOT_TICK_INTERVAL" envDefault:"10m"`

	// Pagination limits
	PaginationDefaultLimit   int `env:"PAGINATION_DEFAULT_LIMIT" envDefault:"50"`
	PaginationMaxAPILimit    int `env:"PAGINATION_MAX_API_LIMIT" envDefault:"500"`
	PaginationMaxFilterLimit int `env:"PAGINATION_MAX_FILTER_LIMIT" envDefault:"2000"`
	PaginationMaxRepoLimit   int `env:"PAGINATION_MAX_REPO_LIMIT" envDefault:"10000"`

	// JWT Authentication
	JWTSecret string `env:"JWT_SECRET" envDefault:"change-me-in-production-to-a-secure-secret"`
	// AdminEmail gates the /api/v1/admin/* read-only operator endpoints. The
	// default is the project owner; override per-environment if needed. Empty
	// disables all admin endpoints (returns 403 for everyone).
	AdminEmail string `env:"ADMIN_EMAIL" envDefault:"rez.zet.int@gmail.com"`
	// Email Provider
	ResendAPIKey string `env:"RESEND_API_KEY" envDefault:""`
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
	AIProvider            string `env:"AI_PROVIDER" envDefault:"googleai"` // googleai, openai, cerebras, groq
	AIAPIKey              string `env:"AI_API_KEY" envDefault:""`
	AIModel               string `env:"AI_MODEL" envDefault:""`                     // Model name (e.g., llama-3.3-70b-versatile for Groq)
	AIFastModel           string `env:"AI_FAST_MODEL" envDefault:""`                // Fast response model (falls back to AI_MODEL)
	AIThinkingModel       string `env:"AI_THINKING_MODEL" envDefault:""`            // Higher-quality thinking model
	AIThinkingModeDefault string `env:"AI_THINKING_MODE_DEFAULT" envDefault:"auto"` // auto|fast|thinking
	AIVisionModel         string `env:"AI_VISION_MODEL" envDefault:""`              // Vision model (auto-detected per provider if empty)
	AICloudProject        string `env:"AI_CLOUD_PROJECT" envDefault:""`             // Google Cloud project ID
	TavilyAPIKey          string `env:"TAVILY_API_KEY" envDefault:""`               // Tavily API key for web search

	// News settings
	NewsCacheTTL time.Duration `env:"NEWS_CACHE_TTL" envDefault:"30m"`

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

	// ML Service Settings
	MLServiceURL string `env:"ML_SERVICE_URL" envDefault:""` // Python ML microservice URL (e.g., http://ml-service:5001)

	// Crypto Integration
	AlchemyAPIKey string `env:"ALCHEMY_API_KEY" envDefault:""` // Alchemy API key for blockchain data
	MoralisAPIKey string `env:"MORALIS_API_KEY" envDefault:""` // Moralis API key (backup)

	// Redis / WebSocket fanout
	RedisURL              string `env:"REDIS_URL" envDefault:""`
	WebSocketRedisChannel string `env:"WS_REDIS_CHANNEL" envDefault:"ws_events"`
}

// Load parses environment variables into Config
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}

	// Validate MaxMemoryResults
	if cfg.MaxMemoryResults < 1 || cfg.MaxMemoryResults > 100 {
		return nil, fmt.Errorf("MAX_MEMORY_RESULTS must be between 1 and 100, got %d", cfg.MaxMemoryResults)
	}
	if cfg.HTTPReadTimeout <= 0 {
		return nil, fmt.Errorf("HTTP_READ_TIMEOUT must be greater than 0, got %s", cfg.HTTPReadTimeout)
	}
	if cfg.HTTPReadHeaderTimeout <= 0 {
		return nil, fmt.Errorf("HTTP_READ_HEADER_TIMEOUT must be greater than 0, got %s", cfg.HTTPReadHeaderTimeout)
	}
	if cfg.HTTPWriteTimeout < 0 {
		return nil, fmt.Errorf("HTTP_WRITE_TIMEOUT must be 0 or greater, got %s", cfg.HTTPWriteTimeout)
	}
	if cfg.HTTPIdleTimeout <= 0 {
		return nil, fmt.Errorf("HTTP_IDLE_TIMEOUT must be greater than 0, got %s", cfg.HTTPIdleTimeout)
	}
	if cfg.HTTPShutdownTimeout <= 0 {
		return nil, fmt.Errorf("HTTP_SHUTDOWN_TIMEOUT must be greater than 0, got %s", cfg.HTTPShutdownTimeout)
	}
	if cfg.HTTPMaxHeaderBytes <= 0 {
		return nil, fmt.Errorf("HTTP_MAX_HEADER_BYTES must be greater than 0, got %d", cfg.HTTPMaxHeaderBytes)
	}

	// Validate DB pool settings
	if cfg.DBMaxConns < 1 {
		return nil, fmt.Errorf("DB_MAX_CONNS must be >= 1, got %d", cfg.DBMaxConns)
	}
	if cfg.DBMinConns < 0 || cfg.DBMinConns > cfg.DBMaxConns {
		return nil, fmt.Errorf("DB_MIN_CONNS must be between 0 and DB_MAX_CONNS (%d), got %d", cfg.DBMaxConns, cfg.DBMinConns)
	}

	// Validate pagination limits
	if cfg.PaginationMaxAPILimit < 1 {
		return nil, fmt.Errorf("PAGINATION_MAX_API_LIMIT must be >= 1, got %d", cfg.PaginationMaxAPILimit)
	}

	// Validate JWT secret in production
	if strings.EqualFold(cfg.Environment, "production") {
		if cfg.JWTSecret == "" || cfg.JWTSecret == "change-me-in-production-to-a-secure-secret" {
			return nil, fmt.Errorf("JWT_SECRET must be set to a secure value in production")
		}
	}

	mode := strings.ToLower(strings.TrimSpace(cfg.AIThinkingModeDefault))
	switch mode {
	case "", "auto", "fast", "thinking":
		if mode == "" {
			mode = "auto"
		}
		cfg.AIThinkingModeDefault = mode
	default:
		return nil, fmt.Errorf("AI_THINKING_MODE_DEFAULT must be one of auto|fast|thinking, got %q", cfg.AIThinkingModeDefault)
	}

	return cfg, nil
}
