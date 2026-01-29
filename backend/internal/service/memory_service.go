package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

// MemoryService orchestrates PostgreSQL and Qdrant memory with fallback logic
type MemoryService struct {
	memoryRepo       *repository.MemoryRepository       // PostgreSQL (source of truth)
	vectorRepo       *repository.VectorMemoryRepository // Qdrant (semantic search)
	embeddingService *EmbeddingService
	maxResults       int
	mu               sync.RWMutex
}

// NewMemoryService creates a new memory service
func NewMemoryService(
	memoryRepo *repository.MemoryRepository,
	vectorRepo *repository.VectorMemoryRepository,
	embeddingService *EmbeddingService,
	maxResults int,
) *MemoryService {
	if maxResults <= 0 {
		maxResults = 10
	}
	return &MemoryService{
		memoryRepo:       memoryRepo,
		vectorRepo:       vectorRepo,
		embeddingService: embeddingService,
		maxResults:       maxResults,
	}
}

// StoreShortTermMemory stores a chat message as short-term memory (async)
// Note: Uses a background context since this is fire-and-forget, but with a timeout
func (s *MemoryService) StoreShortTermMemory(ctx context.Context, userID uuid.UUID, conversationID, role, content string) {
	// Capture values for goroutine to avoid closure issues
	uid := userID
	convID := conversationID
	r := role
	c := content

	// Run async to not block chat response
	go func() {
		// Use background context since parent may be cancelled after HTTP response
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := s.storeShortTermMemorySync(bgCtx, uid, convID, r, c); err != nil {
			log.Warn().Err(err).
				Str("user_id", uid.String()).
				Str("conversation_id", convID).
				Msg("Failed to store short-term memory")
		}
	}()
}

// storeShortTermMemorySync stores short-term memory synchronously
func (s *MemoryService) storeShortTermMemorySync(ctx context.Context, userID uuid.UUID, conversationID, role, content string) error {
	if !s.isVectorEnabled() {
		return nil // Qdrant not available, skip
	}

	// Generate embedding
	embResp, err := s.embeddingService.Embed(ctx, content)
	if err != nil {
		return fmt.Errorf("generating embedding: %w", err)
	}

	memory := &model.VectorMemory{
		UserID:         userID,
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
		MemoryType:     model.MemoryTypeShortTerm,
		CreatedAt:      time.Now(),
	}

	if err := s.vectorRepo.StoreShortTermMemory(ctx, memory, embResp.Embedding); err != nil {
		return fmt.Errorf("storing in qdrant: %w", err)
	}

	return nil
}

// StoreLongTermMemory stores a memory in both PostgreSQL and Qdrant
func (s *MemoryService) StoreLongTermMemory(ctx context.Context, userID uuid.UUID, category, content, source string) (*model.UserMemory, error) {
	// Always store in PostgreSQL (source of truth)
	pgMemory, err := s.memoryRepo.Create(ctx, userID, category, content, source)
	if err != nil {
		return nil, fmt.Errorf("storing in postgresql: %w", err)
	}

	// Store in Qdrant if available (async to not block)
	if s.isVectorEnabled() {
		// Capture values for goroutine to avoid closure issues
		memoryID := pgMemory.ID.String()
		uid := userID
		cat := category
		cont := content
		src := source
		createdAt := pgMemory.CreatedAt

		go func() {
			// Use background context since parent may be cancelled after HTTP response
			bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			// Generate embedding
			embResp, err := s.embeddingService.Embed(bgCtx, cont)
			if err != nil {
				log.Warn().Err(err).Str("memory_id", memoryID).Msg("Failed to generate embedding for long-term memory")
				return
			}

			memory := &model.VectorMemory{
				ID:         memoryID,
				UserID:     uid,
				Category:   cat,
				Content:    cont,
				Source:     src,
				Importance: 0.5, // Default importance
				PostgresID: memoryID,
				MemoryType: model.MemoryTypeLongTerm,
				CreatedAt:  createdAt,
			}

			if err := s.vectorRepo.StoreLongTermMemory(bgCtx, memory, embResp.Embedding); err != nil {
				log.Warn().Err(err).Str("memory_id", memoryID).Msg("Failed to store long-term memory in Qdrant")
			}
		}()
	}

	return pgMemory, nil
}

// GetRelevantMemories retrieves semantically relevant memories for a query
func (s *MemoryService) GetRelevantMemories(ctx context.Context, userID uuid.UUID, query string, conversationID string) (*model.MergedMemoryResult, error) {
	// If vector search available, use semantic search
	if s.isVectorEnabled() {
		return s.getRelevantMemoriesVector(ctx, userID, query, conversationID)
	}

	// Fallback to PostgreSQL recent memories
	return s.getRelevantMemoriesFallback(ctx, userID)
}

// getRelevantMemoriesVector uses Qdrant for semantic search
func (s *MemoryService) getRelevantMemoriesVector(ctx context.Context, userID uuid.UUID, query string, conversationID string) (*model.MergedMemoryResult, error) {
	// Generate embedding for query
	embResp, err := s.embeddingService.Embed(ctx, query)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to generate query embedding, falling back to PostgreSQL")
		return s.getRelevantMemoriesFallback(ctx, userID)
	}

	req := &model.VectorSearchRequest{
		UserID:         userID,
		Query:          query,
		ConversationID: conversationID,
		Limit:          s.maxResults,
		MinScore:       0.5, // Minimum similarity threshold
	}

	result, err := s.vectorRepo.SearchBothMemories(ctx, req, embResp.Embedding)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to search vector memories, falling back to PostgreSQL")
		return s.getRelevantMemoriesFallback(ctx, userID)
	}

	return result, nil
}

// getRelevantMemoriesFallback returns recent memories from PostgreSQL
func (s *MemoryService) getRelevantMemoriesFallback(ctx context.Context, userID uuid.UUID) (*model.MergedMemoryResult, error) {
	memories, err := s.memoryRepo.GetRecent(ctx, userID, s.maxResults)
	if err != nil {
		return nil, fmt.Errorf("getting recent memories: %w", err)
	}

	// Convert to MergedMemoryResult format
	result := &model.MergedMemoryResult{
		LongTermMemories: make([]model.VectorSearchResult, 0, len(memories)),
	}

	for _, m := range memories {
		result.LongTermMemories = append(result.LongTermMemories, model.VectorSearchResult{
			Memory: model.VectorMemory{
				ID:         m.ID.String(),
				UserID:     m.UserID,
				Category:   m.Category,
				Content:    m.Content,
				Source:     m.Source,
				PostgresID: m.ID.String(),
				MemoryType: model.MemoryTypeLongTerm,
				CreatedAt:  m.CreatedAt,
			},
			Score: 1.0, // No semantic score for fallback
		})
	}

	result.TotalResults = len(result.LongTermMemories)

	return result, nil
}

// GetUserMemoriesForContext retrieves memories formatted for AI context
func (s *MemoryService) GetUserMemoriesForContext(ctx context.Context, userID uuid.UUID, currentMessage string) ([]model.UserMemory, error) {
	// Use semantic search if available
	if s.isVectorEnabled() && currentMessage != "" {
		result, err := s.GetRelevantMemories(ctx, userID, currentMessage, "")
		if err == nil && result.TotalResults > 0 {
			return s.mergedResultToUserMemories(result), nil
		}
	}

	// Fallback to recent memories
	return s.memoryRepo.GetRecent(ctx, userID, s.maxResults)
}

// mergedResultToUserMemories converts MergedMemoryResult to []UserMemory
func (s *MemoryService) mergedResultToUserMemories(result *model.MergedMemoryResult) []model.UserMemory {
	memories := make([]model.UserMemory, 0, result.TotalResults)

	// Add long-term memories first (higher priority)
	for _, r := range result.LongTermMemories {
		memories = append(memories, model.UserMemory{
			Category:  r.Memory.Category,
			Content:   r.Memory.Content,
			Source:    r.Memory.Source,
			CreatedAt: r.Memory.CreatedAt,
		})
		if r.Memory.PostgresID != "" {
			if id, err := uuid.Parse(r.Memory.PostgresID); err == nil {
				memories[len(memories)-1].ID = id
				memories[len(memories)-1].UserID = r.Memory.UserID
			}
		}
	}

	// Add relevant short-term memories
	for _, r := range result.ShortTermMemories {
		memories = append(memories, model.UserMemory{
			Category:  "recent_context",
			Content:   fmt.Sprintf("[%s] %s", r.Memory.Role, r.Memory.Content),
			Source:    "conversation",
			CreatedAt: r.Memory.CreatedAt,
		})
	}

	return memories
}

// DeleteMemory removes a memory from both PostgreSQL and Qdrant
func (s *MemoryService) DeleteMemory(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	// Delete from PostgreSQL
	if err := s.memoryRepo.Delete(ctx, id, userID); err != nil {
		return fmt.Errorf("deleting from postgresql: %w", err)
	}

	// Delete from Qdrant if available
	if s.isVectorEnabled() {
		if err := s.vectorRepo.DeleteLongTermMemory(ctx, id.String()); err != nil {
			log.Warn().Err(err).Str("id", id.String()).Msg("Failed to delete memory from Qdrant")
		}
	}

	return nil
}

// SyncLongTermMemoriesToVector syncs existing PostgreSQL memories to Qdrant
func (s *MemoryService) SyncLongTermMemoriesToVector(ctx context.Context, userID uuid.UUID) error {
	if !s.isVectorEnabled() {
		return nil
	}

	memories, err := s.memoryRepo.GetByUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("getting memories from postgresql: %w", err)
	}

	for _, m := range memories {
		// Generate embedding
		embResp, err := s.embeddingService.Embed(ctx, m.Content)
		if err != nil {
			log.Warn().Err(err).Str("id", m.ID.String()).Msg("Failed to generate embedding during sync")
			continue
		}

		memory := &model.VectorMemory{
			ID:         m.ID.String(),
			UserID:     m.UserID,
			Category:   m.Category,
			Content:    m.Content,
			Source:     m.Source,
			Importance: 0.5,
			PostgresID: m.ID.String(),
			MemoryType: model.MemoryTypeLongTerm,
			CreatedAt:  m.CreatedAt,
		}

		if err := s.vectorRepo.StoreLongTermMemory(ctx, memory, embResp.Embedding); err != nil {
			log.Warn().Err(err).Str("id", m.ID.String()).Msg("Failed to sync memory to Qdrant")
		}
	}

	return nil
}

// CleanupExpiredShortTermMemories removes expired short-term memories from Qdrant
func (s *MemoryService) CleanupExpiredShortTermMemories(ctx context.Context) error {
	if !s.isVectorEnabled() {
		return nil
	}
	return s.vectorRepo.CleanupExpiredMemories(ctx)
}

// isVectorEnabled checks if vector search is available
func (s *MemoryService) isVectorEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.vectorRepo != nil && s.embeddingService != nil && s.vectorRepo.IsHealthy()
}

// IsVectorEnabled returns whether vector search is available (public)
func (s *MemoryService) IsVectorEnabled() bool {
	return s.isVectorEnabled()
}
