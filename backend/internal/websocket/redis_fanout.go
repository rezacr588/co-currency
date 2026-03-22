package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// RedisFanout publishes websocket messages via Redis pub/sub.
type RedisFanout struct {
	client  *redis.Client
	channel string
}

type redisEnvelope struct {
	Type      MessageType     `json:"type"`
	UserID    string          `json:"user_id,omitempty"`
	Data      json.RawMessage `json:"data"`
	Timestamp time.Time       `json:"timestamp"`
}

// NewRedisFanout initializes Redis fanout; returns nil when URL is empty.
func NewRedisFanout(redisURL, channel string) (*RedisFanout, error) {
	if redisURL == "" {
		return nil, nil
	}
	if channel == "" {
		channel = "ws_events"
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}

	client := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return &RedisFanout{
		client:  client,
		channel: channel,
	}, nil
}

// Publish sends a message to Redis channel.
func (r *RedisFanout) Publish(ctx context.Context, msg Message) error {
	if r == nil || r.client == nil {
		return nil
	}

	envelope := redisEnvelope{
		Type:      msg.Type,
		Data:      msg.Data,
		Timestamp: time.Now().UTC(),
	}
	if msg.UserID != uuid.Nil {
		envelope.UserID = msg.UserID.String()
	}

	payload, err := json.Marshal(envelope)
	if err != nil {
		return err
	}

	return r.client.Publish(ctx, r.channel, payload).Err()
}

// Subscribe starts a Redis listener and forwards messages to hub.
func (r *RedisFanout) Subscribe(ctx context.Context, hub *Hub) {
	if r == nil || r.client == nil || hub == nil {
		return
	}

	sub := r.client.Subscribe(ctx, r.channel)
	defer sub.Close()
	ch := sub.Channel()

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var env redisEnvelope
			if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
				log.Warn().Err(err).Msg("Failed to decode redis websocket message")
				continue
			}
			wsMsg := Message{
				Type:      env.Type,
				Data:      env.Data,
				Timestamp: env.Timestamp,
			}
			if env.UserID != "" {
				if parsed, err := uuid.Parse(env.UserID); err == nil {
					wsMsg.UserID = parsed
				}
			}
			if err := hub.DispatchMessage(wsMsg); err != nil {
				log.Warn().Err(err).Msg("Failed to dispatch redis websocket message to hub")
			}
		}
	}
}

// Close closes Redis resources.
func (r *RedisFanout) Close() error {
	if r == nil || r.client == nil {
		return nil
	}
	return r.client.Close()
}
