package websocket

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// Publisher fans out websocket events to local hub and (optionally) Redis.
type Publisher struct {
	hub   *Hub
	redis *RedisFanout
}

// NewPublisher creates a new websocket publisher.
func NewPublisher(hub *Hub, redis *RedisFanout) *Publisher {
	return &Publisher{
		hub:   hub,
		redis: redis,
	}
}

// PublishToUser publishes an event to a specific user (and Redis if configured).
func (p *Publisher) PublishToUser(ctx context.Context, userID uuid.UUID, msgType MessageType, payload any) error {
	if userID == uuid.Nil {
		return fmt.Errorf("user_id is required")
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	msg := Message{
		Type:   msgType,
		UserID: userID,
		Data:   raw,
	}

	if p.hub != nil {
		if err := p.hub.DispatchMessage(msg); err != nil {
			return err
		}
	}
	if p.redis != nil {
		if err := p.redis.Publish(ctx, msg); err != nil {
			return err
		}
	}

	return nil
}

// PublishToUsers publishes an event to each user in the list.
func (p *Publisher) PublishToUsers(ctx context.Context, userIDs []uuid.UUID, msgType MessageType, payload any) error {
	seen := make(map[uuid.UUID]struct{}, len(userIDs))
	for _, userID := range userIDs {
		if userID == uuid.Nil {
			continue
		}
		if _, ok := seen[userID]; ok {
			continue
		}
		seen[userID] = struct{}{}
		if err := p.PublishToUser(ctx, userID, msgType, payload); err != nil {
			return err
		}
	}
	return nil
}
