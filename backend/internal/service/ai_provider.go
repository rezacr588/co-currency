package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/googleai"
	"github.com/tmc/langchaingo/llms/openai"
)

// AIService handles AI-powered receipt/invoice parsing, intent detection,
// transcription, and insights.
type AIService struct {
	llm          llms.Model
	llmOnce      sync.Once
	llmErr       error
	llmByModel   map[string]llms.Model
	llmByModelMu sync.RWMutex
	visionLLM    llms.Model
	visionOnce   sync.Once
	visionErr    error
	provider     string
	apiKey       string
	model        string
	visionModel  string
	cloudProject string
}

// NewAIService creates a new AIService with the specified provider.
func NewAIService(provider, apiKey, model, visionModel, cloudProject string) (*AIService, error) {
	if apiKey == "" {
		return nil, errors.New("AI_API_KEY is required")
	}

	// Auto-detect provider if default is used but key matches specific patterns
	p := strings.ToLower(provider)
	if p == "googleai" || p == "gemini" || p == "" {
		if strings.HasPrefix(apiKey, "csk-") {
			p = "cerebras"
		} else if strings.HasPrefix(apiKey, "sk-") {
			p = "openai"
		} else if strings.HasPrefix(apiKey, "gsk_") {
			p = "groq"
		}
	}

	return &AIService{
		provider:     p,
		apiKey:       apiKey,
		model:        model,
		visionModel:  visionModel,
		cloudProject: cloudProject,
		llmByModel:   make(map[string]llms.Model),
	}, nil
}

func (s *AIService) defaultTextModel() string {
	switch s.provider {
	case "cerebras":
		if strings.TrimSpace(s.model) != "" {
			return strings.TrimSpace(s.model)
		}
		return "llama-3.3-70b"
	case "openai":
		if strings.TrimSpace(s.model) != "" {
			return strings.TrimSpace(s.model)
		}
		return "gpt-4o-mini"
	case "groq":
		if strings.TrimSpace(s.model) != "" {
			return strings.TrimSpace(s.model)
		}
		return "llama-3.3-70b-versatile"
	case "googleai", "gemini", "":
		if strings.TrimSpace(s.model) != "" {
			return strings.TrimSpace(s.model)
		}
		return "gemini-1.5-flash"
	default:
		if strings.TrimSpace(s.model) != "" {
			return strings.TrimSpace(s.model)
		}
		return ""
	}
}

func (s *AIService) newTextLLM(ctx context.Context, modelName string) (llms.Model, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = s.defaultTextModel()
	}

	switch s.provider {
	case "cerebras":
		return openai.New(
			openai.WithToken(s.apiKey),
			openai.WithBaseURL("https://api.cerebras.ai/v1"),
			openai.WithModel(modelName),
		)
	case "openai":
		return openai.New(
			openai.WithToken(s.apiKey),
			openai.WithModel(modelName),
		)
	case "groq":
		return openai.New(
			openai.WithToken(s.apiKey),
			openai.WithBaseURL("https://api.groq.com/openai/v1"),
			openai.WithModel(modelName),
		)
	case "googleai", "gemini", "":
		opts := []googleai.Option{
			googleai.WithAPIKey(s.apiKey),
			googleai.WithDefaultModel(modelName),
		}
		if s.cloudProject != "" {
			opts = append(opts, googleai.WithCloudProject(s.cloudProject))
		}
		return googleai.New(ctx, opts...)
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s (supported: groq, cerebras, openai, googleai/gemini)", s.provider)
	}
}

// getLLM initializes the LLM on first use (for text-only operations).
// Thread-safe via sync.Once to prevent race conditions.
func (s *AIService) getLLM(ctx context.Context) (llms.Model, error) {
	s.llmOnce.Do(func() {
		llm, err := s.newTextLLM(ctx, s.defaultTextModel())
		if err != nil {
			s.llmErr = fmt.Errorf("initializing AI provider: %w", err)
			return
		}

		s.llm = llm
		s.llmByModelMu.Lock()
		s.llmByModel[s.defaultTextModel()] = llm
		s.llmByModelMu.Unlock()
	})

	if s.llmErr != nil {
		return nil, s.llmErr
	}
	return s.llm, nil
}

// getLLMForModel returns a text LLM for the requested model, caching by model name.
func (s *AIService) getLLMForModel(ctx context.Context, modelName string) (llms.Model, string, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = s.defaultTextModel()
	}

	if modelName == s.defaultTextModel() {
		llm, err := s.getLLM(ctx)
		return llm, modelName, err
	}

	s.llmByModelMu.RLock()
	if cached := s.llmByModel[modelName]; cached != nil {
		s.llmByModelMu.RUnlock()
		return cached, modelName, nil
	}
	s.llmByModelMu.RUnlock()

	llm, err := s.newTextLLM(ctx, modelName)
	if err != nil {
		return nil, "", err
	}

	s.llmByModelMu.Lock()
	s.llmByModel[modelName] = llm
	s.llmByModelMu.Unlock()

	return llm, modelName, nil
}

// getVisionLLM returns an LLM instance configured for vision/image tasks.
func (s *AIService) getVisionLLM(ctx context.Context) (llms.Model, error) {
	s.visionOnce.Do(func() {
		var llm llms.Model
		var err error

		switch s.provider {
		case "groq":
			model := s.visionModel
			if model == "" {
				model = "llama-3.2-90b-vision-preview"
			}
			llm, err = openai.New(
				openai.WithToken(s.apiKey),
				openai.WithBaseURL("https://api.groq.com/openai/v1"),
				openai.WithModel(model),
			)
		case "openai":
			model := s.visionModel
			if model == "" {
				model = "gpt-4o-mini"
			}
			llm, err = openai.New(
				openai.WithToken(s.apiKey),
				openai.WithModel(model),
			)
		case "googleai", "gemini", "":
			model := s.visionModel
			if model == "" {
				model = "gemini-1.5-flash"
			}
			opts := []googleai.Option{
				googleai.WithAPIKey(s.apiKey),
				googleai.WithDefaultModel(model),
			}
			if s.cloudProject != "" {
				opts = append(opts, googleai.WithCloudProject(s.cloudProject))
			}
			llm, err = googleai.New(ctx, opts...)
		default:
			// Cerebras doesn't support vision, fall back to text LLM
			llm, err = s.getLLM(ctx)
		}

		if err != nil {
			s.visionErr = fmt.Errorf("initializing vision LLM: %w", err)
			return
		}
		s.visionLLM = llm
	})

	if s.visionErr != nil {
		return nil, s.visionErr
	}
	return s.visionLLM, nil
}

// IsConfigured returns true if the AI service is properly configured.
func (s *AIService) IsConfigured() bool {
	return s.apiKey != ""
}

// GetProvider returns the configured AI provider name.
func (s *AIService) GetProvider() string {
	return s.provider
}

// GetDefaultModel returns the resolved default text model name.
func (s *AIService) GetDefaultModel() string {
	return s.defaultTextModel()
}
