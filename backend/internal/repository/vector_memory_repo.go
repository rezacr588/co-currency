package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/qdrant/go-client/qdrant"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

// VectorMemoryRepository handles vector memory operations with Qdrant
type VectorMemoryRepository struct {
	qdrantClient *QdrantClient
	ttl          time.Duration // TTL for short-term memory
}

// NewVectorMemoryRepository creates a new vector memory repository
func NewVectorMemoryRepository(client *QdrantClient, shortTermTTL time.Duration) *VectorMemoryRepository {
	return &VectorMemoryRepository{
		qdrantClient: client,
		ttl:          shortTermTTL,
	}
}

// StoreShortTermMemory stores a message in short-term memory
func (r *VectorMemoryRepository) StoreShortTermMemory(ctx context.Context, memory *model.VectorMemory, embedding []float32) error {
	if r.qdrantClient == nil || !r.qdrantClient.IsHealthy() {
		return fmt.Errorf("qdrant client not available")
	}

	// Generate ID if not provided
	if memory.ID == "" {
		memory.ID = uuid.New().String()
	}

	// Set expiration
	expiresAt := time.Now().Add(r.ttl)
	memory.ExpiresAt = &expiresAt

	point := &qdrant.PointStruct{
		Id:      qdrant.NewID(memory.ID),
		Vectors: qdrant.NewVectors(embedding...),
		Payload: map[string]*qdrant.Value{
			"user_id":         qdrant.NewValueString(memory.UserID.String()),
			"conversation_id": qdrant.NewValueString(memory.ConversationID),
			"role":            qdrant.NewValueString(memory.Role),
			"content":         qdrant.NewValueString(memory.Content),
			"memory_type":     qdrant.NewValueString(string(model.MemoryTypeShortTerm)),
			"created_at":      qdrant.NewValueInt(memory.CreatedAt.Unix()),
			"expires_at":      qdrant.NewValueInt(expiresAt.Unix()),
		},
	}

	return r.qdrantClient.Upsert(ctx, ShortTermMemoryCollection, []*qdrant.PointStruct{point})
}

// StoreLongTermMemory stores a memory in long-term memory
func (r *VectorMemoryRepository) StoreLongTermMemory(ctx context.Context, memory *model.VectorMemory, embedding []float32) error {
	if r.qdrantClient == nil || !r.qdrantClient.IsHealthy() {
		return fmt.Errorf("qdrant client not available")
	}

	// Generate ID if not provided
	if memory.ID == "" {
		memory.ID = uuid.New().String()
	}

	point := &qdrant.PointStruct{
		Id:      qdrant.NewID(memory.ID),
		Vectors: qdrant.NewVectors(embedding...),
		Payload: map[string]*qdrant.Value{
			"user_id":     qdrant.NewValueString(memory.UserID.String()),
			"category":    qdrant.NewValueString(memory.Category),
			"content":     qdrant.NewValueString(memory.Content),
			"source":      qdrant.NewValueString(memory.Source),
			"importance":  qdrant.NewValueDouble(float64(memory.Importance)),
			"memory_type": qdrant.NewValueString(string(model.MemoryTypeLongTerm)),
			"created_at":  qdrant.NewValueInt(memory.CreatedAt.Unix()),
			"postgres_id": qdrant.NewValueString(memory.PostgresID),
		},
	}

	return r.qdrantClient.Upsert(ctx, LongTermMemoryCollection, []*qdrant.PointStruct{point})
}

// SearchShortTermMemory searches short-term memory by semantic similarity
func (r *VectorMemoryRepository) SearchShortTermMemory(ctx context.Context, req *model.VectorSearchRequest, embedding []float32) ([]model.VectorSearchResult, error) {
	if r.qdrantClient == nil || !r.qdrantClient.IsHealthy() {
		return nil, fmt.Errorf("qdrant client not available")
	}

	// Build filter
	var filter *qdrant.Filter
	if req.ConversationID != "" {
		filter = BuildUserConversationFilter(req.UserID.String(), req.ConversationID)
	} else {
		filter = BuildUserFilter(req.UserID.String())
	}

	// Add expiration filter (only non-expired)
	now := time.Now().Unix()
	if filter.Must == nil {
		filter.Must = []*qdrant.Condition{}
	}
	filter.Must = append(filter.Must, qdrant.NewRange("expires_at", &qdrant.Range{
		Gt: qdrant.PtrOf(float64(now)),
	}))

	limit := uint64(req.Limit)
	if limit == 0 {
		limit = 10
	}

	scored, err := r.qdrantClient.Search(ctx, ShortTermMemoryCollection, embedding, filter, limit)
	if err != nil {
		return nil, fmt.Errorf("searching short-term memory: %w", err)
	}

	return r.scoredPointsToResults(scored, req.MinScore)
}

// SearchLongTermMemory searches long-term memory by semantic similarity
func (r *VectorMemoryRepository) SearchLongTermMemory(ctx context.Context, req *model.VectorSearchRequest, embedding []float32) ([]model.VectorSearchResult, error) {
	if r.qdrantClient == nil || !r.qdrantClient.IsHealthy() {
		return nil, fmt.Errorf("qdrant client not available")
	}

	filter := BuildUserFilter(req.UserID.String())

	limit := uint64(req.Limit)
	if limit == 0 {
		limit = 10
	}

	scored, err := r.qdrantClient.Search(ctx, LongTermMemoryCollection, embedding, filter, limit)
	if err != nil {
		return nil, fmt.Errorf("searching long-term memory: %w", err)
	}

	return r.scoredPointsToResults(scored, req.MinScore)
}

// SearchBothMemories searches both short-term and long-term memory
func (r *VectorMemoryRepository) SearchBothMemories(ctx context.Context, req *model.VectorSearchRequest, embedding []float32) (*model.MergedMemoryResult, error) {
	result := &model.MergedMemoryResult{}

	// Search short-term memory
	shortTermResults, err := r.SearchShortTermMemory(ctx, req, embedding)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to search short-term memory")
	} else {
		result.ShortTermMemories = shortTermResults
	}

	// Search long-term memory
	longTermResults, err := r.SearchLongTermMemory(ctx, req, embedding)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to search long-term memory")
	} else {
		result.LongTermMemories = longTermResults
	}

	result.TotalResults = len(result.ShortTermMemories) + len(result.LongTermMemories)

	return result, nil
}

// DeleteShortTermMemory deletes a specific short-term memory
func (r *VectorMemoryRepository) DeleteShortTermMemory(ctx context.Context, id string) error {
	if r.qdrantClient == nil {
		return fmt.Errorf("qdrant client not available")
	}
	return r.qdrantClient.DeleteByID(ctx, ShortTermMemoryCollection, id)
}

// DeleteLongTermMemory deletes a specific long-term memory
func (r *VectorMemoryRepository) DeleteLongTermMemory(ctx context.Context, id string) error {
	if r.qdrantClient == nil {
		return fmt.Errorf("qdrant client not available")
	}
	return r.qdrantClient.DeleteByID(ctx, LongTermMemoryCollection, id)
}

// DeleteUserShortTermMemories deletes all short-term memories for a user
func (r *VectorMemoryRepository) DeleteUserShortTermMemories(ctx context.Context, userID uuid.UUID) error {
	if r.qdrantClient == nil {
		return fmt.Errorf("qdrant client not available")
	}
	filter := BuildUserFilter(userID.String())
	return r.qdrantClient.Delete(ctx, ShortTermMemoryCollection, filter)
}

// DeleteUserLongTermMemories deletes all long-term memories for a user
func (r *VectorMemoryRepository) DeleteUserLongTermMemories(ctx context.Context, userID uuid.UUID) error {
	if r.qdrantClient == nil {
		return fmt.Errorf("qdrant client not available")
	}
	filter := BuildUserFilter(userID.String())
	return r.qdrantClient.Delete(ctx, LongTermMemoryCollection, filter)
}

// DeleteConversationMemories deletes all short-term memories for a specific conversation
func (r *VectorMemoryRepository) DeleteConversationMemories(ctx context.Context, userID uuid.UUID, conversationID string) error {
	if r.qdrantClient == nil {
		return fmt.Errorf("qdrant client not available")
	}
	filter := BuildUserConversationFilter(userID.String(), conversationID)
	return r.qdrantClient.Delete(ctx, ShortTermMemoryCollection, filter)
}

// CleanupExpiredMemories removes expired short-term memories
func (r *VectorMemoryRepository) CleanupExpiredMemories(ctx context.Context) error {
	if r.qdrantClient == nil {
		return fmt.Errorf("qdrant client not available")
	}
	return r.qdrantClient.DeleteExpired(ctx, ShortTermMemoryCollection)
}

// IsHealthy returns whether the repository is healthy
func (r *VectorMemoryRepository) IsHealthy() bool {
	return r.qdrantClient != nil && r.qdrantClient.IsHealthy()
}

// scoredPointsToResults converts Qdrant scored points to VectorSearchResults
func (r *VectorMemoryRepository) scoredPointsToResults(scored []*qdrant.ScoredPoint, minScore float32) ([]model.VectorSearchResult, error) {
	results := make([]model.VectorSearchResult, 0, len(scored))

	for _, sp := range scored {
		if sp.Score < minScore {
			continue
		}

		memory := model.VectorMemory{
			CreatedAt: time.Now(), // Will be overwritten
		}

		// Extract ID
		if id := sp.GetId(); id != nil {
			if strID := id.GetUuid(); strID != "" {
				memory.ID = strID
			} else if numID := id.GetNum(); numID != 0 {
				memory.ID = fmt.Sprintf("%d", numID)
			}
		}

		// Extract payload
		payload := sp.GetPayload()
		if payload != nil {
			if v, ok := payload["user_id"]; ok {
				if uid, err := uuid.Parse(v.GetStringValue()); err == nil {
					memory.UserID = uid
				}
			}
			if v, ok := payload["conversation_id"]; ok {
				memory.ConversationID = v.GetStringValue()
			}
			if v, ok := payload["role"]; ok {
				memory.Role = v.GetStringValue()
			}
			if v, ok := payload["category"]; ok {
				memory.Category = v.GetStringValue()
			}
			if v, ok := payload["content"]; ok {
				memory.Content = v.GetStringValue()
			}
			if v, ok := payload["source"]; ok {
				memory.Source = v.GetStringValue()
			}
			if v, ok := payload["importance"]; ok {
				memory.Importance = float32(v.GetDoubleValue())
			}
			if v, ok := payload["postgres_id"]; ok {
				memory.PostgresID = v.GetStringValue()
			}
			if v, ok := payload["memory_type"]; ok {
				memory.MemoryType = model.MemoryType(v.GetStringValue())
			}
			if v, ok := payload["created_at"]; ok {
				memory.CreatedAt = time.Unix(v.GetIntegerValue(), 0)
			}
			if v, ok := payload["expires_at"]; ok {
				if ts := v.GetIntegerValue(); ts > 0 {
					t := time.Unix(ts, 0)
					memory.ExpiresAt = &t
				}
			}
		}

		results = append(results, model.VectorSearchResult{
			Memory: memory,
			Score:  sp.Score,
		})
	}

	return results, nil
}
