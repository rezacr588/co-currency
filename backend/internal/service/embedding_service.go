package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/embeddings"
	"github.com/tmc/langchaingo/llms/googleai"
	"github.com/tmc/langchaingo/llms/ollama"
)

// EmbeddingProvider represents supported embedding providers
type EmbeddingProvider string

const (
	EmbeddingProviderHuggingFace EmbeddingProvider = "huggingface"
	EmbeddingProviderOllama      EmbeddingProvider = "ollama"
	EmbeddingProviderGoogleAI    EmbeddingProvider = "googleai"
)

// EmbeddingConfig holds configuration for the embedding service
type EmbeddingConfig struct {
	Provider   EmbeddingProvider
	APIKey     string
	Model      string
	Dimensions int
	OllamaURL  string
}

// EmbeddingService generates embeddings for text using various providers
type EmbeddingService struct {
	config     EmbeddingConfig
	embedder   *embeddings.EmbedderImpl
	httpClient *http.Client
}

// NewEmbeddingService creates a new embedding service based on the provider
func NewEmbeddingService(cfg EmbeddingConfig) (*EmbeddingService, error) {
	svc := &EmbeddingService{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	switch cfg.Provider {
	case EmbeddingProviderHuggingFace:
		// HuggingFace uses HTTP API directly (not langchaingo embeddings)
		if cfg.APIKey == "" {
			return nil, fmt.Errorf("HuggingFace API key is required")
		}
		log.Info().
			Str("provider", string(cfg.Provider)).
			Str("model", cfg.Model).
			Int("dimensions", cfg.Dimensions).
			Msg("Embedding service initialized with HuggingFace")

	case EmbeddingProviderOllama:
		// Create Ollama embedder using langchaingo
		llm, err := ollama.New(
			ollama.WithModel(cfg.Model),
			ollama.WithServerURL(cfg.OllamaURL),
		)
		if err != nil {
			return nil, fmt.Errorf("creating ollama client: %w", err)
		}
		embedder, err := embeddings.NewEmbedder(llm)
		if err != nil {
			return nil, fmt.Errorf("creating ollama embedder: %w", err)
		}
		svc.embedder = embedder
		log.Info().
			Str("provider", string(cfg.Provider)).
			Str("model", cfg.Model).
			Str("url", cfg.OllamaURL).
			Int("dimensions", cfg.Dimensions).
			Msg("Embedding service initialized with Ollama")

	case EmbeddingProviderGoogleAI:
		// Create Google AI embedder
		llm, err := googleai.New(
			context.Background(),
			googleai.WithAPIKey(cfg.APIKey),
			googleai.WithDefaultEmbeddingModel(cfg.Model),
		)
		if err != nil {
			return nil, fmt.Errorf("creating google ai client: %w", err)
		}
		embedder, err := embeddings.NewEmbedder(llm)
		if err != nil {
			return nil, fmt.Errorf("creating google ai embedder: %w", err)
		}
		svc.embedder = embedder
		log.Info().
			Str("provider", string(cfg.Provider)).
			Str("model", cfg.Model).
			Int("dimensions", cfg.Dimensions).
			Msg("Embedding service initialized with Google AI")

	default:
		return nil, fmt.Errorf("unsupported embedding provider: %s", cfg.Provider)
	}

	return svc, nil
}

// Embed generates an embedding for the given text
func (s *EmbeddingService) Embed(ctx context.Context, text string) (*model.EmbeddingResponse, error) {
	if text == "" {
		return nil, fmt.Errorf("text is required for embedding")
	}

	var embedding []float32
	var err error

	switch s.config.Provider {
	case EmbeddingProviderHuggingFace:
		embedding, err = s.embedWithHuggingFace(ctx, text)
	default:
		// Use langchaingo embedder for Ollama and Google AI
		if s.embedder == nil {
			return nil, fmt.Errorf("embedder not initialized")
		}
		embeddings, embErr := s.embedder.EmbedDocuments(ctx, []string{text})
		if embErr != nil {
			err = embErr
		} else if len(embeddings) > 0 {
			embedding = embeddings[0]
		} else {
			err = fmt.Errorf("no embedding returned")
		}
	}

	if err != nil {
		return nil, fmt.Errorf("generating embedding: %w", err)
	}

	return &model.EmbeddingResponse{
		Embedding:  embedding,
		Dimensions: len(embedding),
		Model:      s.config.Model,
	}, nil
}

// EmbedBatch generates embeddings for multiple texts
func (s *EmbeddingService) EmbedBatch(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	switch s.config.Provider {
	case EmbeddingProviderHuggingFace:
		// HuggingFace supports batch embedding
		return s.embedBatchWithHuggingFace(ctx, texts)
	default:
		// Use langchaingo embedder for batch
		if s.embedder == nil {
			return nil, fmt.Errorf("embedder not initialized")
		}
		return s.embedder.EmbedDocuments(ctx, texts)
	}
}

// embedWithHuggingFace calls the HuggingFace Inference API
func (s *EmbeddingService) embedWithHuggingFace(ctx context.Context, text string) ([]float32, error) {
	embeddings, err := s.embedBatchWithHuggingFace(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	if len(embeddings) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}
	return embeddings[0], nil
}

// embedBatchWithHuggingFace calls the HuggingFace Inference API for batch embedding
func (s *EmbeddingService) embedBatchWithHuggingFace(ctx context.Context, texts []string) ([][]float32, error) {
	url := fmt.Sprintf("https://router.huggingface.co/hf-inference/models/%s/pipeline/feature-extraction", s.config.Model)

	// Prepare request body
	body, err := json.Marshal(map[string]interface{}{
		"inputs": texts,
		"options": map[string]bool{
			"wait_for_model": true,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.config.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("making request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HuggingFace API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	// Parse response - HuggingFace returns [][]float64
	var result [][]float64
	if err := json.Unmarshal(respBody, &result); err != nil {
		// Try single result format
		var singleResult []float64
		if err2 := json.Unmarshal(respBody, &singleResult); err2 == nil {
			result = [][]float64{singleResult}
		} else {
			return nil, fmt.Errorf("parsing response: %w (body: %s)", err, string(respBody))
		}
	}

	// Convert float64 to float32
	embeddings := make([][]float32, len(result))
	for i, emb := range result {
		embeddings[i] = make([]float32, len(emb))
		for j, v := range emb {
			embeddings[i][j] = float32(v)
		}
	}

	return embeddings, nil
}

// GetDimensions returns the embedding dimensions
func (s *EmbeddingService) GetDimensions() int {
	return s.config.Dimensions
}

// GetProvider returns the embedding provider
func (s *EmbeddingService) GetProvider() EmbeddingProvider {
	return s.config.Provider
}

// GetModel returns the embedding model
func (s *EmbeddingService) GetModel() string {
	return s.config.Model
}
