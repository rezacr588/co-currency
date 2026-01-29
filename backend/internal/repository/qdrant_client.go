package repository

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"github.com/qdrant/go-client/qdrant"
	"github.com/rs/zerolog/log"
)

const (
	// Collection names
	ShortTermMemoryCollection = "short_term_memory"
	LongTermMemoryCollection  = "long_term_memory"
)

// QdrantConfig holds Qdrant connection configuration
type QdrantConfig struct {
	URL        string
	APIKey     string
	Dimensions uint64
}

// QdrantClient wraps the Qdrant gRPC client with health checks and retry logic
type QdrantClient struct {
	client     *qdrant.Client
	config     QdrantConfig
	isHealthy  bool
	lastCheck  time.Time
	checkMutex chan struct{}
}

// NewQdrantClient creates a new Qdrant client with the given configuration
func NewQdrantClient(cfg QdrantConfig) (*QdrantClient, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("qdrant URL is required")
	}

	// Parse URL to extract host (without port for Qdrant client)
	host := cfg.URL
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimPrefix(host, "http://")
	// Remove port if present (Qdrant client adds it automatically)
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}

	// Create the client with TLS for cloud Qdrant
	client, err := qdrant.NewClient(&qdrant.Config{
		Host:   host,
		Port:   6334,
		APIKey: cfg.APIKey,
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
		// Enable gRPC connection
		UseTLS: true,
	})
	if err != nil {
		return nil, fmt.Errorf("creating qdrant client: %w", err)
	}

	qc := &QdrantClient{
		client:     client,
		config:     cfg,
		checkMutex: make(chan struct{}, 1),
	}

	// Initialize collections
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := qc.initCollections(ctx); err != nil {
		log.Warn().Err(err).Msg("Failed to initialize Qdrant collections (will retry on next operation)")
	} else {
		qc.isHealthy = true
		qc.lastCheck = time.Now()
	}

	return qc, nil
}

// initCollections creates the short-term and long-term memory collections if they don't exist
func (qc *QdrantClient) initCollections(ctx context.Context) error {
	collections := []string{ShortTermMemoryCollection, LongTermMemoryCollection}

	for _, name := range collections {
		exists, err := qc.collectionExists(ctx, name)
		if err != nil {
			return fmt.Errorf("checking collection %s: %w", name, err)
		}

		if !exists {
			if err := qc.createCollection(ctx, name); err != nil {
				return fmt.Errorf("creating collection %s: %w", name, err)
			}
			log.Info().Str("collection", name).Msg("Created Qdrant collection")
		}
	}

	return nil
}

// collectionExists checks if a collection exists
func (qc *QdrantClient) collectionExists(ctx context.Context, name string) (bool, error) {
	return qc.client.CollectionExists(ctx, name)
}

// createCollection creates a new collection with the specified dimensions
func (qc *QdrantClient) createCollection(ctx context.Context, name string) error {
	return qc.client.CreateCollection(ctx, &qdrant.CreateCollection{
		CollectionName: name,
		VectorsConfig: qdrant.NewVectorsConfig(&qdrant.VectorParams{
			Size:     qc.config.Dimensions,
			Distance: qdrant.Distance_Cosine,
		}),
	})
}

// IsHealthy returns whether the client connection is healthy
func (qc *QdrantClient) IsHealthy() bool {
	// Return cached health status if checked recently
	if time.Since(qc.lastCheck) < 30*time.Second {
		return qc.isHealthy
	}

	// Try to acquire mutex for health check (non-blocking)
	select {
	case qc.checkMutex <- struct{}{}:
		defer func() { <-qc.checkMutex }()
	default:
		// Another health check is in progress, return cached status
		return qc.isHealthy
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	exists, err := qc.client.CollectionExists(ctx, ShortTermMemoryCollection)
	qc.isHealthy = err == nil && exists
	qc.lastCheck = time.Now()

	return qc.isHealthy
}

// Upsert adds or updates points in a collection
func (qc *QdrantClient) Upsert(ctx context.Context, collection string, points []*qdrant.PointStruct) error {
	if len(points) == 0 {
		return nil
	}

	_, err := qc.client.Upsert(ctx, &qdrant.UpsertPoints{
		CollectionName: collection,
		Points:         points,
		Wait:           qdrant.PtrOf(true),
	})
	return err
}

// Search performs a vector similarity search in a collection
func (qc *QdrantClient) Search(ctx context.Context, collection string, vector []float32, filter *qdrant.Filter, limit uint64) ([]*qdrant.ScoredPoint, error) {
	result, err := qc.client.Query(ctx, &qdrant.QueryPoints{
		CollectionName: collection,
		Query:          qdrant.NewQuery(vector...),
		Filter:         filter,
		Limit:          qdrant.PtrOf(limit),
		WithPayload:    qdrant.NewWithPayload(true),
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// Delete removes points from a collection by filter
func (qc *QdrantClient) Delete(ctx context.Context, collection string, filter *qdrant.Filter) error {
	_, err := qc.client.Delete(ctx, &qdrant.DeletePoints{
		CollectionName: collection,
		Points:         qdrant.NewPointsSelectorFilter(filter),
		Wait:           qdrant.PtrOf(true),
	})
	return err
}

// DeleteByID removes a specific point by ID
func (qc *QdrantClient) DeleteByID(ctx context.Context, collection string, id string) error {
	_, err := qc.client.Delete(ctx, &qdrant.DeletePoints{
		CollectionName: collection,
		Points:         qdrant.NewPointsSelectorIDs([]*qdrant.PointId{qdrant.NewIDUUID(id)}),
		Wait:           qdrant.PtrOf(true),
	})
	return err
}

// DeleteExpired removes points that have expired (for short-term memory)
func (qc *QdrantClient) DeleteExpired(ctx context.Context, collection string) error {
	now := time.Now().Unix()
	filter := &qdrant.Filter{
		Must: []*qdrant.Condition{
			qdrant.NewMatchInt("expires_at", int64(0)),
		},
		MustNot: []*qdrant.Condition{
			qdrant.NewRange("expires_at", &qdrant.Range{
				Gte: qdrant.PtrOf(float64(now)),
			}),
		},
	}

	// Actually delete expired points using range filter
	filter = &qdrant.Filter{
		Must: []*qdrant.Condition{
			qdrant.NewRange("expires_at", &qdrant.Range{
				Lt: qdrant.PtrOf(float64(now)),
				Gt: qdrant.PtrOf(float64(0)), // Exclude 0 (no expiry)
			}),
		},
	}

	return qc.Delete(ctx, collection, filter)
}

// Close closes the Qdrant client connection
func (qc *QdrantClient) Close() error {
	if qc.client != nil {
		return qc.client.Close()
	}
	return nil
}

// GetClient returns the underlying Qdrant client for advanced operations
func (qc *QdrantClient) GetClient() *qdrant.Client {
	return qc.client
}

// BuildUserFilter creates a filter for user-specific queries
func BuildUserFilter(userID string) *qdrant.Filter {
	return &qdrant.Filter{
		Must: []*qdrant.Condition{
			qdrant.NewMatchKeyword("user_id", userID),
		},
	}
}

// BuildUserConversationFilter creates a filter for user and conversation specific queries
func BuildUserConversationFilter(userID, conversationID string) *qdrant.Filter {
	return &qdrant.Filter{
		Must: []*qdrant.Condition{
			qdrant.NewMatchKeyword("user_id", userID),
			qdrant.NewMatchKeyword("conversation_id", conversationID),
		},
	}
}
