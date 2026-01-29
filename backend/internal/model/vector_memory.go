package model

import (
	"time"

	"github.com/google/uuid"
)

// MemoryType distinguishes between short-term and long-term memory
type MemoryType string

const (
	MemoryTypeShortTerm MemoryType = "short_term"
	MemoryTypeLongTerm  MemoryType = "long_term"
)

// VectorMemory represents a memory stored in the vector database
type VectorMemory struct {
	ID             string     `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	ConversationID string     `json:"conversation_id,omitempty"` // Only for short-term
	Role           string     `json:"role,omitempty"`            // "user" or "assistant" for short-term
	Category       string     `json:"category,omitempty"`        // For long-term: "preference", "goal", "habit", etc.
	Content        string     `json:"content"`
	Source         string     `json:"source,omitempty"`     // For long-term: "user_stated", "ai_inferred"
	Importance     float32    `json:"importance,omitempty"` // 0.0-1.0 for ranking
	PostgresID     string     `json:"postgres_id,omitempty"`
	MemoryType     MemoryType `json:"memory_type"`
	CreatedAt      time.Time  `json:"created_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"` // For short-term TTL
}

// VectorSearchRequest represents a semantic search request
type VectorSearchRequest struct {
	UserID         uuid.UUID  `json:"user_id"`
	Query          string     `json:"query"`
	MemoryType     MemoryType `json:"memory_type,omitempty"` // Empty = search both
	ConversationID string     `json:"conversation_id,omitempty"`
	Limit          int        `json:"limit"`
	MinScore       float32    `json:"min_score,omitempty"` // Minimum similarity score (0.0-1.0)
}

// VectorSearchResult represents a memory search result with similarity score
type VectorSearchResult struct {
	Memory VectorMemory `json:"memory"`
	Score  float32      `json:"score"` // Similarity score (0.0-1.0)
}

// MergedMemoryResult represents combined results from short and long-term memory
type MergedMemoryResult struct {
	ShortTermMemories []VectorSearchResult `json:"short_term_memories"`
	LongTermMemories  []VectorSearchResult `json:"long_term_memories"`
	TotalResults      int                  `json:"total_results"`
}

// EmbeddingRequest represents a request to generate embeddings
type EmbeddingRequest struct {
	Text  string `json:"text"`
	Model string `json:"model,omitempty"`
}

// EmbeddingResponse represents the embedding generation result
type EmbeddingResponse struct {
	Embedding  []float32 `json:"embedding"`
	Dimensions int       `json:"dimensions"`
	Model      string    `json:"model"`
}
